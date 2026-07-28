from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parent
APP_DIR = ROOT_DIR.parent / "attendance_tracker_app"
DB_PATH = APP_DIR / "attendance.db"
OUTPUT_PATH = ROOT_DIR / "schedule.json"
EMBEDDED_OUTPUT_PATH = ROOT_DIR / "schedule-data.js"

TIMELINE_SLOTS = [
    {"label": "Slot 1", "start_time": "08:45", "end_time": "10:00", "kind": "lecture"},
    {"label": "Slot 2", "start_time": "10:15", "end_time": "11:30", "kind": "lecture"},
    {"label": "Slot 3", "start_time": "11:45", "end_time": "13:00", "kind": "lecture"},
    {"label": "Lunch Time", "start_time": "13:00", "end_time": "14:30", "kind": "lunch"},
    {"label": "Slot 4", "start_time": "14:30", "end_time": "15:45", "kind": "lecture"},
    {"label": "Slot 5", "start_time": "16:00", "end_time": "17:15", "kind": "lecture"},
    {"label": "Slot 6", "start_time": "17:45", "end_time": "19:00", "kind": "lecture"},
    {"label": "Slot 7", "start_time": "19:15", "end_time": "20:30", "kind": "lecture"},
]


def load_subjects(connection: sqlite3.Connection) -> dict[int, dict[str, Any]]:
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """
        SELECT
            id,
            name,
            code,
            credits,
            expected_lecture_count,
            faculty,
            start_date,
            end_date,
            location,
            lecture_type,
            batch_division,
            schedule_summary
        FROM subjects
        ORDER BY name
        """
    ).fetchall()

    subjects: dict[int, dict[str, Any]] = {}
    for row in rows:
        subjects[row["id"]] = {
            "id": row["id"],
            "name": row["name"],
            "code": row["code"] or "",
            "credits": row["credits"],
            "expected_lecture_count": row["expected_lecture_count"],
            "faculty": row["faculty"] or "",
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "location": row["location"] or "",
            "lecture_type": row["lecture_type"] or "",
            "batch_division": row["batch_division"] or "",
            "schedule_summary": row["schedule_summary"] or "",
        }
    return subjects


def slot_label_for(start_time: str) -> str:
    for slot in TIMELINE_SLOTS:
        if slot["start_time"] == start_time:
            return slot["label"]
    return "Custom Slot"


def mandatory_label(is_first: int, is_last: int) -> str:
    if is_first:
        return "Mandatory - First Lecture"
    if is_last:
        return "Mandatory - Last Lecture"
    return ""


def load_lecture_entries(connection: sqlite3.Connection, subjects: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            id,
            subject_id,
            lecture_number,
            lecture_date,
            start_time,
            end_time,
            location,
            lecture_type,
            faculty,
            batch_division,
            is_mandatory_first,
            is_mandatory_last,
            is_cancelled,
            is_extra,
            stable_id,
            source_sheet,
            source_cell,
            day_name,
            day_type,
            faculty_abbreviation,
            attendance_tracked,
            schedule_status
        FROM lectures
        ORDER BY lecture_date, start_time, subject_id, lecture_number
        """
    ).fetchall()

    entries: list[dict[str, Any]] = []
    for row in rows:
        subject = subjects[row["subject_id"]]
        entries.append(
            {
                "id": f"lecture-{row['id']}",
                "raw_id": row["id"],
                "type": "lecture",
                "date": row["lecture_date"],
                "day_name": row["day_name"] or datetime.fromisoformat(row["lecture_date"]).strftime("%A"),
                "day_type": row["day_type"] or "",
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "slot_label": slot_label_for(row["start_time"]),
                "title": subject["name"],
                "subject": subject,
                "lecture_number": row["lecture_number"],
                "faculty": row["faculty"] or subject["faculty"],
                "faculty_abbreviation": row["faculty_abbreviation"] or "",
                "location": row["location"] or subject["location"],
                "lecture_type": row["lecture_type"] or subject["lecture_type"],
                "batch_division": row["batch_division"] or subject["batch_division"],
                "attendance_tracked": bool(row["attendance_tracked"]),
                "schedule_status": row["schedule_status"] or "confirmed",
                "is_cancelled": bool(row["is_cancelled"]),
                "is_extra": bool(row["is_extra"]),
                "mandatory_label": mandatory_label(row["is_mandatory_first"], row["is_mandatory_last"]),
                "stable_id": row["stable_id"] or "",
                "source": {
                    "sheet": row["source_sheet"] or "",
                    "cell": row["source_cell"] or "",
                },
            }
        )
    return entries


def load_special_event_entries(connection: sqlite3.Connection, subjects: dict[int, dict[str, Any]]) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT
            id,
            stable_id,
            title,
            event_date,
            start_time,
            end_time,
            day_name,
            day_type,
            venue,
            source_sheet,
            source_cell,
            attendance_tracked,
            event_category,
            subject_id,
            audience_scope,
            audience_value,
            notes
        FROM special_events
        ORDER BY event_date, start_time, title
        """
    ).fetchall()

    entries: list[dict[str, Any]] = []
    for row in rows:
        linked_subject = subjects.get(row["subject_id"]) if row["subject_id"] else None
        entries.append(
            {
                "id": f"event-{row['id']}",
                "raw_id": row["id"],
                "type": "event",
                "date": row["event_date"],
                "day_name": row["day_name"] or datetime.fromisoformat(row["event_date"]).strftime("%A"),
                "day_type": row["day_type"] or "",
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "slot_label": slot_label_for(row["start_time"]),
                "title": row["title"],
                "subject": linked_subject,
                "lecture_number": None,
                "faculty": linked_subject["faculty"] if linked_subject else "",
                "faculty_abbreviation": "",
                "location": row["venue"] or (linked_subject["location"] if linked_subject else ""),
                "lecture_type": "",
                "batch_division": "",
                "attendance_tracked": bool(row["attendance_tracked"]),
                "schedule_status": "event",
                "is_cancelled": False,
                "is_extra": False,
                "mandatory_label": "",
                "stable_id": row["stable_id"] or "",
                "event_category": row["event_category"] or "general",
                "audience_scope": row["audience_scope"] or "all",
                "audience_value": row["audience_value"] or "",
                "notes": row["notes"] or "",
                "source": {
                    "sheet": row["source_sheet"] or "",
                    "cell": row["source_cell"] or "",
                },
            }
        )
    return entries


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Could not find attendance database at {DB_PATH}")

    connection = sqlite3.connect(DB_PATH)
    try:
        subjects = load_subjects(connection)
        lectures = load_lecture_entries(connection, subjects)
        events = load_special_event_entries(connection, subjects)
        entries = sorted(lectures + events, key=lambda item: (item["date"], item["start_time"], item["title"]))
        all_dates = [entry["date"] for entry in entries]

        payload = {
            "generated_at": datetime.now().replace(second=0, microsecond=0).isoformat(timespec="minutes"),
            "source": {
                "type": "sqlite",
                "database_path": str(DB_PATH.relative_to(ROOT_DIR.parent)).replace("\\", "/"),
                "lecture_count": len(lectures),
                "event_count": len(events),
                "subject_count": len(subjects),
            },
            "coverage": {
                "start_date": min(all_dates) if all_dates else None,
                "end_date": max(all_dates) if all_dates else None,
                "months": sorted({entry["date"][:7] for entry in entries}),
            },
            "slots": TIMELINE_SLOTS,
            "subjects": sorted(subjects.values(), key=lambda item: (item["name"], item["code"])),
            "entries": entries,
        }

        json_text = json.dumps(payload, indent=2, ensure_ascii=False)
        OUTPUT_PATH.write_text(json_text, encoding="utf-8")
        EMBEDDED_OUTPUT_PATH.write_text(
            f"window.__STATIC_SCHEDULE_DATA__ = {json_text};\n",
            encoding="utf-8",
        )
        print(f"Wrote {OUTPUT_PATH}")
        print(f"Wrote {EMBEDDED_OUTPUT_PATH}")
        print(f"Lectures: {len(lectures)} | Events: {len(events)} | Subjects: {len(subjects)}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
