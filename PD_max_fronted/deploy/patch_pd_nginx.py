#!/usr/bin/env python3
"""Merge /project3 snippet into pd.conf: strip old include, insert after real server_name line (run on server)."""
import re
import subprocess
import sys

DEFAULT_PD = "/etc/nginx/sites-available/pd.conf"
INCLUDE_LINE = "    include /etc/nginx/snippets/ai-frontend-project3.conf;\n"


def strip_our_include(text: str) -> str:
    out = []
    for ln in text.splitlines(keepends=True):
        core = ln.rstrip("\r\n")
        if re.match(r"^\s*include\s+/etc/nginx/snippets/ai-frontend-project3\.conf;\s*$", core):
            continue
        out.append(ln)
    return "".join(out)


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "usage: patch_pd_nginx.py <token[,token2,...]> [pd.conf path]",
            file=sys.stderr,
        )
        print(
            "  多个 token 用英文逗号分隔，按顺序尝试匹配 server_name 行（域名未写入时可带 IP）",
            file=sys.stderr,
        )
        sys.exit(2)
    raw = sys.argv[1]
    tokens = [t.strip() for t in raw.split(",") if t.strip()]
    if not tokens:
        print("ERR: empty token list", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_PD

    r = subprocess.run(["sudo", "cat", path], capture_output=True, text=True, check=True)
    text = strip_our_include(r.stdout)

    for token in tokens:
        pat = (
            r"(^[\t ]*server_name\s+[^;\n]*"
            + re.escape(token)
            + r"[^;\n]*;\s*\n)"
        )
        if re.search(pat, text, flags=re.MULTILINE):
            new_text = re.sub(
                pat, r"\1" + INCLUDE_LINE, text, count=1, flags=re.MULTILINE
            )
            subprocess.run(["sudo", "tee", path], input=new_text, text=True, check=True)
            print("patched_ok matched=" + token)
            return

    print("ERR: no server_name line containing any of:", ", ".join(tokens), file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
