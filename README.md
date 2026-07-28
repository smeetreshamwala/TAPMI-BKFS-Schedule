# TAPMI BKFS 25-27 Static Site

This folder contains the static student-facing schedule site.

There is no Flask backend in the browser. The pages read pre-generated JSON files only.

## Pages

- `index.html` - student code login
- `today.html` - today's schedule for the logged-in student
- `calendar.html` - monthly calendar plus full-day timeline
- `courses.html` - mapped subjects for the logged-in student
- `cohort.html` - birthday table
- `menu.html` - mess menu
- `admin.html` - single-admin schedule editor

## Student Login

Students identify themselves with a code in the format `25B###`.

Example:

- `25B147`

This is only an identification flow so the site knows which student's schedule to show. It is not a secure password-based login.

The selected student code is stored locally in the browser so the student stays on their own pages until they click `Switch Person`.

## Data Files

- `schedule.json` and `schedule-data.js` - schedule snapshot
- `students.json` and `students-data.js` - Excel-sourced roster
- `menu.json` and `menu-data.js` - mess menu

## Roster Source

The student roster is generated from:

- `C:\Users\Smeet\Documents\New project 2\attendance_tracker_app\List of students.xlsx`

The current workbook sheet detected by the generator is:

- `Sheet1`

The generator reads the roster only. It does not modify the workbook or the Flask app.

## Student Mapping Model

Each student record contains their own `course_ids` list.

That means future terms can give two students in the same section different mapped subjects without changing the code. Only the data needs to change.

Current student shape:

- `id`
- `student_code`
- `roll_no`
- `name`
- `birthday`
- `section_id`
- `section_name`
- `course_ids`
- `tags`

## Regenerate Schedule And Roster

Whenever the SQLite schedule or the Excel roster changes, run:

```powershell
& 'C:\Users\Smeet\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' .\generate_schedule_json.py
```

This refreshes:

- `schedule.json`
- `schedule-data.js`
- `students.json`
- `students-data.js`

## Run Locally

Simple local server:

```powershell
python -m http.server 8000
```

Then open:

- `http://127.0.0.1:8000/`

## Deploy To Netlify

This folder is Netlify-ready with no build step.

You can:

1. Drag the whole `static_schedule_site/` folder onto [Netlify Drop](https://app.netlify.com/drop)
2. Or push it to GitHub and set Netlify's publish directory to `static_schedule_site`

## Admin Editor

The admin editor is separate from the student login flow.

Path:

- `<your-site>.netlify.app/admin.html`

Required Netlify environment variables:

- `ADMIN_PASSWORD`
- `GITHUB_TOKEN`

The editor updates `schedule.json` and `schedule-data.js` through the Netlify Function and GitHub commit flow.
