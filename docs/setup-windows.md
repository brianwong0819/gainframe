# Windows setup (M0-02)

bw does these steps by hand once. Run commands in **PowerShell** unless noted — the prompt must start with `PS` (e.g. `PS C:\dev>`). A prompt without `PS` is Command Prompt (cmd), where these commands fail; type `powershell` to switch.

## 1. Move the repo out of OneDrive

OneDrive tries to sync every file in `node_modules`, `.next` and `.terraform` (hundreds of thousands of files) and locks files mid-install, which causes random `EPERM` errors in pnpm. Move the repo to a plain folder:

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/brianwong0819/gainframe.git
```

Then delete the old copy under `OneDrive\Desktop\gainframe` once you have checked nothing uncommitted is left (`git status`). Open `C:\dev\gainframe` in VS Code from now on.

## 2. Tools

First check that `winget` (Windows Package Manager) works: `winget --version`. If PowerShell says *"winget is not recognized"*:

1. Re-register it (fixes the common case where it is installed but not registered):
   `Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe`
2. Still missing → open Microsoft Store, search **App Installer**, install or update it.
3. Close and reopen VS Code (a terminal only sees programs installed before it started), then `winget --version` again.

Then install the tools. **After each `winget install`, open a new terminal** before using that tool.

```powershell
winget install --id Git.Git                  # skip if `git --version` already works
winget install --id Schniz.fnm               # Node version manager
winget install --id Docker.DockerDesktop     # choose the WSL 2 backend when asked; reboot
winget install --id Hashicorp.Terraform
winget install --id Amazon.AWSCLI
winget install --id GitHub.cli
```

Make `node` available in every new terminal: run `notepad $PROFILE` (create the file if asked), add this line, save, and open a new terminal:

```powershell
fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression
```

If PowerShell refuses to load the profile ("running scripts is disabled"), run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Then:

```powershell
fnm install --lts; fnm use --lts             # M0-04 pins the exact major in .nvmrc
corepack enable                              # gives you pnpm; if "access denied", run this one in an admin PowerShell
gh auth login
git config --global core.autocrlf false      # .gitattributes handles line endings
```

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
