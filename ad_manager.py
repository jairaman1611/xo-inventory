#!/usr/bin/env python3
"""
ad_manager.py — Interactive Active Directory Management Tool
Connects from Mac to Windows AD Domain Controllers via LDAP/LDAPS.

Dependencies: pip3 install ldap3
Usage:        python3 ad_manager.py
"""

import sys
import ssl
import getpass
import traceback
from typing import Optional

try:
    from ldap3 import (
        Server, Connection, ALL, NTLM, SUBTREE, MODIFY_REPLACE,
        MODIFY_ADD, MODIFY_DELETE, Tls, ALL_ATTRIBUTES
    )
    from ldap3.core.exceptions import (
        LDAPException, LDAPBindError, LDAPSocketOpenError,
        LDAPOperationResult
    )
    from ldap3.extend.microsoft.addMembersToGroups import ad_add_members_to_groups
    from ldap3.extend.microsoft.removeMembersFromGroups import ad_remove_members_from_groups
    from ldap3.extend.microsoft.modifyPassword import ad_modify_password
    from ldap3.extend.microsoft.unlockAccount import ad_unlock_account
except ImportError:
    print("\n❌  ldap3 not installed. Run:  pip3 install ldap3\n")
    sys.exit(1)


# ── Colour helpers ────────────────────────────────────────────────────────────

class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    BLUE   = "\033[94m"
    CYAN   = "\033[96m"
    MAGENTA= "\033[95m"
    DIM    = "\033[2m"

def ok(msg):    print(f"{C.GREEN}  ✓  {msg}{C.RESET}")
def err(msg):   print(f"{C.RED}  ✗  {msg}{C.RESET}")
def warn(msg):  print(f"{C.YELLOW}  ⚠  {msg}{C.RESET}")
def info(msg):  print(f"{C.CYAN}  ℹ  {msg}{C.RESET}")
def head(msg):  print(f"\n{C.BOLD}{C.BLUE}{'─'*60}\n  {msg}\n{'─'*60}{C.RESET}")
def sub(msg):   print(f"{C.MAGENTA}  →  {msg}{C.RESET}")


# ── DC definitions ────────────────────────────────────────────────────────────

DCS = [
    {"id": "UK",  "host": "uk1-dc10.eu.uk.com",   "base_dn": "DC=eu,DC=uk,DC=com"},
    {"id": "NL",  "host": "nl1-dc01.eu.nl.com",   "base_dn": "DC=eu,DC=nl,DC=com"},
    {"id": "SV",  "host": "sv1-dc01.sv.zen.com",  "base_dn": "DC=sv,DC=zen,DC=com"},
    {"id": "NJ",  "host": "nj1-dc01.nj.zen.com",  "base_dn": "DC=nj,DC=zen,DC=com"},
]


# ── LDAP connection ───────────────────────────────────────────────────────────

def connect_dc(dc: dict, username: str, password: str) -> Optional[Connection]:
    """
    Connect to a DC using LDAPS (port 636) first, fall back to LDAP (port 389).
    Uses NTLM auth which works with domain\\user or user@domain formats.
    """
    for port, use_ssl in [(636, True), (389, False)]:
        try:
            tls = Tls(validate=ssl.CERT_NONE) if use_ssl else None
            server = Server(
                dc["host"], port=port,
                use_ssl=use_ssl, tls=tls,
                get_info=ALL, connect_timeout=8
            )
            conn = Connection(
                server, user=username, password=password,
                authentication=NTLM, auto_bind=True
            )
            proto = "LDAPS" if use_ssl else "LDAP"
            ok(f"Connected to {dc['id']} ({dc['host']}) via {proto}")
            return conn
        except LDAPBindError:
            err(f"Authentication failed for {dc['id']} — check credentials")
            return None
        except LDAPSocketOpenError:
            continue  # try next port
        except Exception as e:
            continue

    err(f"Cannot reach {dc['id']} ({dc['host']}) — VPN connected?")
    return None


# ── User lookup ───────────────────────────────────────────────────────────────

def find_user(conn: Connection, base_dn: str, search_term: str) -> Optional[dict]:
    """Search for a user by sAMAccountName, UPN, or display name."""
    filters = [
        f"(sAMAccountName={search_term})",
        f"(userPrincipalName={search_term})",
        f"(displayName={search_term})",
        f"(cn={search_term})",
    ]
    combined = f"(|{''.join(filters)})"
    conn.search(
        base_dn,
        f"(&(objectClass=user)(objectCategory=person){combined})",
        SUBTREE,
        attributes=["distinguishedName", "sAMAccountName", "displayName",
                    "mail", "memberOf", "userAccountControl",
                    "pwdLastSet", "lockoutTime", "description"]
    )
    if not conn.entries:
        return None
    return conn.entries[0]


def find_group(conn: Connection, base_dn: str, group_name: str) -> Optional[dict]:
    """Search for a group by name."""
    conn.search(
        base_dn,
        f"(&(objectClass=group)(|(cn={group_name})(sAMAccountName={group_name})))",
        SUBTREE,
        attributes=["distinguishedName", "cn", "description", "member"]
    )
    if not conn.entries:
        return None
    return conn.entries[0]


def get_dn(entry) -> str:
    return str(entry.entry_dn)


def is_account_disabled(uac) -> bool:
    try:
        return bool(int(str(uac)) & 2)
    except Exception:
        return False


def print_user_summary(entry, dc_id: str):
    print(f"\n  {C.BOLD}User found on {dc_id}:{C.RESET}")
    print(f"  {'Display Name':<18} {entry.displayName}")
    print(f"  {'sAMAccountName':<18} {entry.sAMAccountName}")
    print(f"  {'Email':<18} {entry.mail}")
    uac = str(entry.userAccountControl)
    status = f"{C.RED}Disabled{C.RESET}" if is_account_disabled(entry.userAccountControl) else f"{C.GREEN}Enabled{C.RESET}"
    print(f"  {'Account Status':<18} {status}")
    groups = entry.memberOf.values if hasattr(entry.memberOf, 'values') else []
    if groups:
        print(f"  {'Member of':<18}")
        for g in groups[:8]:
            cn = g.split(",")[0].replace("CN=","")
            print(f"    {C.DIM}• {cn}{C.RESET}")
        if len(groups) > 8:
            print(f"    {C.DIM}  … and {len(groups)-8} more{C.RESET}")


# ── Operations ────────────────────────────────────────────────────────────────

def op_reset_password(conn: Connection, base_dn: str, dc_id: str):
    head(f"PASSWORD RESET — {dc_id}")
    username = input("  Username (sAMAccountName or email): ").strip()
    if not username:
        return

    user = find_user(conn, base_dn, username)
    if not user:
        err(f"User '{username}' not found on {dc_id}")
        return
    print_user_summary(user, dc_id)

    new_pass = getpass.getpass("\n  New password: ")
    confirm  = getpass.getpass("  Confirm password: ")
    if new_pass != confirm:
        err("Passwords do not match")
        return
    if len(new_pass) < 8:
        err("Password must be at least 8 characters")
        return

    must_change = input("  Force password change on next login? [y/N]: ").strip().lower() == "y"

    try:
        result = ad_modify_password(conn, get_dn(user), new_pass, old_password=None)
        if result:
            ok(f"Password reset for {user.displayName} on {dc_id}")
            if must_change:
                conn.modify(get_dn(user), {"pwdLastSet": [(MODIFY_REPLACE, [0])]})
                ok("User will be prompted to change password on next login")
        else:
            err(f"Password reset failed on {dc_id}: {conn.result}")
    except Exception as e:
        err(f"Error: {e}")


def op_unlock_account(conn: Connection, base_dn: str, dc_id: str):
    head(f"UNLOCK ACCOUNT — {dc_id}")
    username = input("  Username: ").strip()
    if not username:
        return

    user = find_user(conn, base_dn, username)
    if not user:
        err(f"User '{username}' not found on {dc_id}")
        return
    print_user_summary(user, dc_id)

    confirm = input(f"\n  Unlock account for {user.displayName}? [y/N]: ").strip().lower()
    if confirm != "y":
        warn("Cancelled")
        return

    try:
        result = ad_unlock_account(conn, get_dn(user))
        if result:
            ok(f"Account unlocked for {user.displayName} on {dc_id}")
        else:
            err(f"Unlock failed on {dc_id}: {conn.result}")
    except Exception as e:
        err(f"Error: {e}")


def op_modify_group(conn: Connection, base_dn: str, dc_id: str):
    head(f"MODIFY GROUP MEMBERSHIP — {dc_id}")
    username = input("  Username: ").strip()
    if not username:
        return

    user = find_user(conn, base_dn, username)
    if not user:
        err(f"User '{username}' not found on {dc_id}")
        return
    print_user_summary(user, dc_id)

    print(f"\n  Action:")
    print(f"    {C.CYAN}[1]{C.RESET} Add to group")
    print(f"    {C.CYAN}[2]{C.RESET} Remove from group")
    action = input("  Choice [1/2]: ").strip()
    if action not in ("1", "2"):
        warn("Cancelled")
        return

    group_name = input("  Group name: ").strip()
    if not group_name:
        return

    group = find_group(conn, base_dn, group_name)
    if not group:
        err(f"Group '{group_name}' not found on {dc_id}")
        return

    sub(f"Group DN: {get_dn(group)}")
    confirm = input(f"\n  {'Add' if action=='1' else 'Remove'} {user.displayName} "
                    f"{'to' if action=='1' else 'from'} {group.cn}? [y/N]: ").strip().lower()
    if confirm != "y":
        warn("Cancelled")
        return

    try:
        if action == "1":
            result = ad_add_members_to_groups(conn, [get_dn(user)], [get_dn(group)])
            if result:
                ok(f"Added {user.displayName} to {group.cn} on {dc_id}")
            else:
                err(f"Failed: {conn.result}")
        else:
            result = ad_remove_members_from_groups(conn, [get_dn(user)], [get_dn(group)], fix=True)
            if result:
                ok(f"Removed {user.displayName} from {group.cn} on {dc_id}")
            else:
                err(f"Failed: {conn.result}")
    except Exception as e:
        err(f"Error: {e}")


def op_change_permissions(conn: Connection, base_dn: str, dc_id: str):
    head(f"CHANGE ACCOUNT PERMISSIONS — {dc_id}")
    username = input("  Username: ").strip()
    if not username:
        return

    user = find_user(conn, base_dn, username)
    if not user:
        err(f"User '{username}' not found on {dc_id}")
        return
    print_user_summary(user, dc_id)

    print(f"\n  Permission action:")
    print(f"    {C.CYAN}[1]{C.RESET} Enable account")
    print(f"    {C.CYAN}[2]{C.RESET} Disable account")
    print(f"    {C.CYAN}[3]{C.RESET} Set account description")
    choice = input("  Choice [1/2/3]: ").strip()

    try:
        if choice == "1":
            confirm = input(f"  Enable account for {user.displayName}? [y/N]: ").strip().lower()
            if confirm != "y": return
            current_uac = int(str(user.userAccountControl))
            new_uac = current_uac & ~2  # clear disabled bit
            conn.modify(get_dn(user), {"userAccountControl": [(MODIFY_REPLACE, [new_uac])]})
            ok(f"Account enabled for {user.displayName} on {dc_id}")

        elif choice == "2":
            confirm = input(f"  Disable account for {user.displayName}? [y/N]: ").strip().lower()
            if confirm != "y": return
            current_uac = int(str(user.userAccountControl))
            new_uac = current_uac | 2  # set disabled bit
            conn.modify(get_dn(user), {"userAccountControl": [(MODIFY_REPLACE, [new_uac])]})
            ok(f"Account disabled for {user.displayName} on {dc_id}")

        elif choice == "3":
            desc = input("  New description: ").strip()
            if not desc: return
            conn.modify(get_dn(user), {"description": [(MODIFY_REPLACE, [desc])]})
            ok(f"Description updated for {user.displayName} on {dc_id}")
        else:
            warn("Invalid choice")
    except Exception as e:
        err(f"Error: {e}")


def op_create_user(conn: Connection, base_dn: str, dc_id: str, domain_suffix: str):
    head(f"CREATE NEW USER — {dc_id}")

    print(f"  {C.DIM}Fill in user details (press Enter to skip optional fields){C.RESET}\n")

    first       = input("  First name *: ").strip()
    last        = input("  Last name  *: ").strip()
    if not first or not last:
        err("First and last name are required")
        return

    suggested_sam = f"{first[0].lower()}{last.lower()}"
    sam = input(f"  sAMAccountName [{suggested_sam}]: ").strip() or suggested_sam

    domain_part = domain_suffix  # e.g. @sv.zen.com
    upn = input(f"  UPN [{sam}{domain_part}]: ").strip() or f"{sam}{domain_part}"

    email    = input(f"  Email [{upn}]: ").strip() or upn
    title    = input("  Job title (optional): ").strip()
    dept     = input("  Department (optional): ").strip()
    phone    = input("  Phone (optional): ").strip()

    # OU selection
    print(f"\n  {C.DIM}Common OUs (or enter full OU path):{C.RESET}")
    print(f"    {C.CYAN}[1]{C.RESET} CN=Users,{base_dn}  (default)")
    print(f"    {C.CYAN}[2]{C.RESET} Custom OU path")
    ou_choice = input("  Choice [1/2]: ").strip()
    if ou_choice == "2":
        ou = input("  OU path (e.g. OU=IT,OU=Staff): ").strip()
        user_dn = f"CN={first} {last},{ou},{base_dn}"
    else:
        user_dn = f"CN={first} {last},CN=Users,{base_dn}"

    password = getpass.getpass("\n  Initial password *: ")
    confirm  = getpass.getpass("  Confirm password  *: ")
    if password != confirm:
        err("Passwords do not match")
        return

    must_change = input("  Force password change on next login? [Y/n]: ").strip().lower() != "n"

    # Groups
    groups_input = input("  Add to groups (comma-separated, optional): ").strip()
    group_names  = [g.strip() for g in groups_input.split(",") if g.strip()]

    print(f"\n  {C.BOLD}Summary:{C.RESET}")
    print(f"  {'Name':<20} {first} {last}")
    print(f"  {'sAMAccountName':<20} {sam}")
    print(f"  {'UPN':<20} {upn}")
    print(f"  {'Email':<20} {email}")
    print(f"  {'DN':<20} {user_dn}")
    if groups_input:
        print(f"  {'Groups':<20} {groups_input}")

    confirm = input(f"\n  Create this user on {dc_id}? [y/N]: ").strip().lower()
    if confirm != "y":
        warn("Cancelled")
        return

    try:
        attrs = {
            "objectClass":        ["top", "person", "organizationalPerson", "user"],
            "sAMAccountName":     sam,
            "userPrincipalName":  upn,
            "givenName":          first,
            "sn":                 last,
            "displayName":        f"{first} {last}",
            "mail":               email,
            "userAccountControl": 514,  # disabled until password set
        }
        if title:  attrs["title"]          = title
        if dept:   attrs["department"]     = dept
        if phone:  attrs["telephoneNumber"]= phone

        conn.add(user_dn, attributes=attrs)
        if conn.result["result"] != 0:
            err(f"Failed to create user: {conn.result['description']}")
            return
        ok(f"User account created: {user_dn}")

        # Set password
        result = ad_modify_password(conn, user_dn, password, old_password=None)
        if not result:
            err(f"Could not set password — account created but disabled: {conn.result}")
            return
        ok("Password set")

        # Enable account (UAC 512 = normal enabled, 66048 = enabled+no expire)
        uac = 512 if not must_change else 512
        conn.modify(user_dn, {"userAccountControl": [(MODIFY_REPLACE, [uac])]})
        if must_change:
            conn.modify(user_dn, {"pwdLastSet": [(MODIFY_REPLACE, [0])]})
        ok("Account enabled")

        # Add to groups
        for gname in group_names:
            group = find_group(conn, base_dn, gname)
            if not group:
                warn(f"Group '{gname}' not found — skipping")
                continue
            result = ad_add_members_to_groups(conn, [user_dn], [get_dn(group)])
            if result:
                ok(f"Added to group: {gname}")
            else:
                warn(f"Could not add to group '{gname}': {conn.result}")

        ok(f"✅  User {first} {last} ({sam}) created successfully on {dc_id}")

    except Exception as e:
        err(f"Error creating user: {e}")
        if "--debug" in sys.argv:
            traceback.print_exc()


def op_lookup_user(conn: Connection, base_dn: str, dc_id: str):
    head(f"LOOK UP USER — {dc_id}")
    username = input("  Username, email, or display name: ").strip()
    if not username:
        return
    user = find_user(conn, base_dn, username)
    if not user:
        err(f"User '{username}' not found on {dc_id}")
        return
    print_user_summary(user, dc_id)
    print(f"\n  {C.DIM}Distinguished Name:{C.RESET}")
    print(f"  {C.DIM}{get_dn(user)}{C.RESET}")


# ── DC selector ───────────────────────────────────────────────────────────────

def select_dcs() -> list[dict]:
    print(f"\n{C.BOLD}  Select Domain Controller(s):{C.RESET}")
    for i, dc in enumerate(DCS, 1):
        print(f"    {C.CYAN}[{i}]{C.RESET}  {dc['id']:<4}  {dc['host']}")
    print(f"    {C.CYAN}[5]{C.RESET}  All DCs")
    print(f"    {C.CYAN}[6]{C.RESET}  Select multiple (e.g. 1,3)")

    choice = input("\n  Choice: ").strip()

    if choice == "5":
        return DCS[:]
    elif choice == "6":
        indices = [c.strip() for c in choice.split(",")]
        selected = []
        for idx in indices:
            try:
                selected.append(DCS[int(idx)-1])
            except (ValueError, IndexError):
                pass
        return selected if selected else select_dcs()
    else:
        # Handle comma-separated input like "1,3"
        if "," in choice:
            selected = []
            for idx in choice.split(","):
                try:
                    selected.append(DCS[int(idx.strip())-1])
                except (ValueError, IndexError):
                    pass
            return selected if selected else select_dcs()
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(DCS):
                return [DCS[idx]]
        except (ValueError, IndexError):
            pass

    warn("Invalid choice")
    return select_dcs()


def select_operation() -> str:
    print(f"\n{C.BOLD}  Select Operation:{C.RESET}")
    ops = [
        ("1", "Reset password"),
        ("2", "Unlock account"),
        ("3", "Enable / Disable account"),
        ("4", "Change group membership"),
        ("5", "Create new user"),
        ("6", "Look up user"),
        ("0", "Exit"),
    ]
    for code, label in ops:
        color = C.RED if code == "0" else C.CYAN
        print(f"    {color}[{code}]{C.RESET}  {label}")

    return input("\n  Choice: ").strip()


# ── Credential prompt ─────────────────────────────────────────────────────────

def prompt_credentials(dc: dict) -> tuple[str, str]:
    """
    Prompt for credentials. Supports:
      DOMAIN\\username  (classic NTLM)
      username@domain  (UPN)
    """
    print(f"\n  {C.DIM}Credentials for {dc['host']}{C.RESET}")
    default_domain = dc["host"].split(".", 1)[1] if "." in dc["host"] else ""
    username = input(f"  Username [DOMAIN\\\\user or user@{default_domain}]: ").strip()
    password = getpass.getpass("  Password: ")
    return username, password


# ── Domain suffix helper ──────────────────────────────────────────────────────

def domain_suffix(dc: dict) -> str:
    parts = dc["host"].split(".", 1)
    return "@" + parts[1] if len(parts) > 1 else ""


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    print(f"""
{C.BOLD}{C.MAGENTA}╔══════════════════════════════════════════════════════╗
║     Planview AD Manager — Interactive CLI Tool       ║
║     Connects to Windows Active Directory via LDAP    ║
╚══════════════════════════════════════════════════════╝{C.RESET}
""")

    # Credentials — ask once, reuse across DCs (or per-DC if needed)
    print(f"  {C.DIM}You can use shared credentials across all DCs, or enter")
    print(f"  per-DC credentials if accounts differ across domains.{C.RESET}")
    shared = input("\n  Use same credentials for all DCs? [Y/n]: ").strip().lower() != "n"

    shared_user = shared_pass = None
    if shared:
        print(f"\n  {C.DIM}Enter credentials (will be used for all selected DCs):{C.RESET}")
        shared_user = input("  Username (DOMAIN\\\\user or user@domain): ").strip()
        shared_pass = getpass.getpass("  Password: ")

    # Main session loop
    while True:
        print()
        selected_dcs = select_dcs()
        if not selected_dcs:
            continue

        op = select_operation()
        if op == "0":
            print(f"\n  {C.DIM}Goodbye.{C.RESET}\n")
            break
        if op not in ("1","2","3","4","5","6"):
            warn("Invalid operation")
            continue

        # Connect to each selected DC and run the operation
        for dc in selected_dcs:
            print(f"\n{C.BOLD}{C.BLUE}  ── {dc['id']} ({dc['host']}) ──{C.RESET}")

            if shared:
                username, password = shared_user, shared_pass
            else:
                username, password = prompt_credentials(dc)

            conn = connect_dc(dc, username, password)
            if not conn:
                continue

            try:
                if   op == "1": op_reset_password(conn, dc["base_dn"], dc["id"])
                elif op == "2": op_unlock_account(conn, dc["base_dn"], dc["id"])
                elif op == "3": op_change_permissions(conn, dc["base_dn"], dc["id"])
                elif op == "4": op_modify_group(conn, dc["base_dn"], dc["id"])
                elif op == "5": op_create_user(conn, dc["base_dn"], dc["id"], domain_suffix(dc))
                elif op == "6": op_lookup_user(conn, dc["base_dn"], dc["id"])
            except KeyboardInterrupt:
                warn("Operation interrupted")
            except Exception as e:
                err(f"Unexpected error on {dc['id']}: {e}")
                if "--debug" in sys.argv:
                    traceback.print_exc()
            finally:
                try:
                    conn.unbind()
                except Exception:
                    pass

        if len(selected_dcs) > 1:
            print(f"\n{C.GREEN}{C.BOLD}  ✓  Operation completed on {len(selected_dcs)} DC(s){C.RESET}")

        again = input(f"\n  {C.DIM}Run another operation? [Y/n]: {C.RESET}").strip().lower()
        if again == "n":
            print(f"\n  {C.DIM}Goodbye.{C.RESET}\n")
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n  {C.DIM}Interrupted. Goodbye.{C.RESET}\n")
        sys.exit(0)
