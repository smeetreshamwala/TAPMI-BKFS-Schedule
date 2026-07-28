# Static Schedule Site

This folder is a fully static schedule-only snapshot of the existing `attendance_tracker_app`.

It has:

- `index.html`
- `style.css`
- `script.js`
- `admin.html`
- `admin.css`
- `admin.js`
- `schedule.json`
- `schedule-data.js`
- `generate_schedule_json.py`
- `repo-config.json`
- `netlify/functions/update-schedule.js`

There is no Flask runtime, no login, and no database access in the browser.

## Update The Schedule

Whenever the source data changes in `attendance_tracker_app/attendance.db`, regenerate the static snapshot:

```powershell
& 'C:\Users\Smeet\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\generate_schedule_json.py
```

That script only reads from the original app database and writes a fresh `schedule.json` and `schedule-data.js` into this folder.

## Run Locally

This site now works in both of these ways:

1. Double-click `index.html`
2. Or use a simple local static server

Using a local server is still useful for testing the same way Netlify will serve it:

```powershell
python -m http.server 8000
```

Then open:

```text
http://127.0.0.1:8000/
```

## Deploy To Netlify

This folder is already Netlify Drop ready.

You can:

1. Drag the whole `static_schedule_site/` folder onto [Netlify Drop](https://app.netlify.com/drop)
2. Or push it to GitHub and set Netlify's publish directory to `static_schedule_site`

No build step is required.

## Single-Admin Editor

This project includes a simple single-admin editor at:

```text
<your-site>.netlify.app/admin.html
```

It is intentionally single-user and lightweight:

- one shared password
- one Netlify Function
- one GitHub-backed `schedule.json`
- no public signup, no multi-user roles, no CMS

### Before you deploy the editor

1. Update [repo-config.json](./repo-config.json) with your real values:
   - `owner`
   - `repo`
   - `branch`
2. Make sure the Netlify site is connected to that same GitHub repo.

### Netlify environment variables

Set these in the Netlify dashboard:

`Site settings → Environment variables`

Required variables:

- `ADMIN_PASSWORD`
- `GITHUB_TOKEN`

Important:

- `ADMIN_PASSWORD` must be scoped so it is available to **Functions**
- `GITHUB_TOKEN` must also be available to **Functions**
- do not put either value in any committed file

### GitHub token setup

Use a **fine-grained personal access token** for only this repo.

Recommended steps:

1. In GitHub, open `Settings`
2. Open `Developer settings`
3. Open `Personal access tokens`
4. Open `Fine-grained tokens`
5. Click `Generate new token`
6. Restrict it to the exact repository used by this site
7. Give it the minimum repository permission:
   - `Contents: Read and write`
8. Copy that token into Netlify as `GITHUB_TOKEN`

The editor uses the GitHub Contents API server-side to:

- fetch the latest `schedule.json`
- apply add/edit/delete changes for event entries
- write the updated `schedule.json`
- sync `schedule-data.js` so the public static site stays in sync

### Using the editor

1. Open `<your-site>.netlify.app/admin.html`
2. Enter the shared admin password
3. After successful server-side validation:
   - you can view current events
   - add a new event
   - edit an existing event
   - delete an event
4. Every save writes back to GitHub, which triggers Netlify to redeploy

### Scope of the editor

This admin page edits **event entries** in `schedule.json`.

It does **not** edit the original Flask app or the imported lecture data inside `attendance_tracker_app`.

### Security note

This editor is intentionally simple:

- single shared password
- password sent to the Netlify Function for each action
- no token/JWT session layer
- no multi-user access control

That is fine for one trusted admin, but it is not designed for multiple editors or public account creation.

## Data Source

The static site is generated from:

- `../attendance_tracker_app/attendance.db`

It currently exports:

- subject metadata
- lecture schedule entries
- special event schedule entries
- the same 8-slot day timeline layout used by the Flask app
