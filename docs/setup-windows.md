# Windows setup (M0-02)

bw does these steps by hand once. Run commands in **PowerShell** unless noted.

## 1. Move the repo out of OneDrive

OneDrive tries to sync every file in `node_modules`, `.next` and `.terraform` (hundreds of thousands of files) and locks files mid-install, which causes random `EPERM` errors in pnpm. Move the repo to a plain folder:

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/brianwong0819/gainframe.git
```

Then delete the old copy under `OneDrive\Desktop\gainframe` once you have checked nothing uncommitted is left (`git status`). Open `C:\dev\gainframe` in VS Code from now on.

## 2. Tools

```powershell
winget install --id Git.Git                  # if not already installed
winget install --id Schniz.fnm               # Node version manager
fnm install --lts; fnm use --lts             # M0-04 pins the exact major in .nvmrc
corepack enable                              # gives you pnpm at the version pinned in package.json
winget install --id Docker.DockerDesktop     # choose the WSL 2 backend when asked; reboot
winget install --id Hashicorp.Terraform
winget install --id Amazon.AWSCLI
winget install --id GitHub.cli
gh auth login
git config --global core.autocrlf false      # .gitattributes handles line endings
```

Add fnm to your PowerShell profile so `node` is available in new terminals:
`fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression` (put it in `notepad $PROFILE`).

Claude Code: install per https://code.claude.com/docs (native Windows installer), then `claude` in the repo folder.

## 3. Claude Code plugins and MCP

Follow "Install now" in [docs/tooling.md](tooling.md).

## 4. AWS CLI with SSO (after M0-03)

```powershell
aws configure sso          # SSO start URL from IAM Identity Center, region ap-southeast-1, profile name: gainframe
aws sso login --profile gainframe
aws sts get-caller-identity --profile gainframe
```

## 5. Check

```powershell
node -v; pnpm -v; docker run --rm hello-world; terraform -version; aws --version; gh auth status
```

All six must work before M0-04.
