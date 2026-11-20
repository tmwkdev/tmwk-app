# Telemetry v0: feedback forms open a GitHub issue

Screenshots from a background E2E build (`electron-vite build --mode e2e`, `ORCA_BACKGROUND_LAUNCH=1`,
`ORCA_E2E_HEADLESS=1`) on a disposable profile and home, 1280 × 900 viewport. The window stayed
hidden (`isVisible() === false`) and was never shown or focused. The run replaced `shell.openExternal`
with a recorder, so no browser opened and no issue was created. It also wrapped the main process's `net.fetch`.

| Form                                     | Before click                                 | After click                                            |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| Help → Send Feedback                     | [feedback-dialog.png](feedback-dialog.png)   | [feedback-toast.png](feedback-toast.png)               |
| Report a crash (no captured report)      | [crash-dialog.png](crash-dialog.png)         | [crash-toast.png](crash-toast.png)                     |
| Settings → Language → Request a language | [language-request.png](language-request.png) | [language-request-done.png](language-request-done.png) |

[transcript.txt](transcript.txt) holds each issue URL the app opened, plus the clipboard after each click.
The main process made no `net.fetch` call during the run, so nothing went to `orca.dev`.
The crash screenshot still shows the feedback form's toast from the step before.
