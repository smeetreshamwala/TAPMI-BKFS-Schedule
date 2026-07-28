const { Buffer } = require("node:buffer");
const repoConfig = require("../../repo-config.json");

const GITHUB_API = "https://api.github.com";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function assertRuntimeConfig() {
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error("Missing ADMIN_PASSWORD in Netlify environment variables.");
  }
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("Missing GITHUB_TOKEN in Netlify environment variables.");
  }
  if (
    !repoConfig.owner ||
    !repoConfig.repo ||
    repoConfig.owner.includes("YOUR_GITHUB") ||
    repoConfig.repo.includes("YOUR_REPO")
  ) {
    throw new Error("Update repo-config.json with the real GitHub owner and repo before using the admin editor.");
  }
}

function normalizeTime(value) {
  return String(value || "").slice(0, 5);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function deriveDayName(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  return parsed.toLocaleDateString("en-US", { weekday: "long" });
}

function slotLabelFor(startTime, slots) {
  const slot = (slots || []).find((item) => item.start_time === startTime);
  return slot ? slot.label : "Custom Slot";
}

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function githubFileUrl(path) {
  return `${GITHUB_API}/repos/${repoConfig.owner}/${repoConfig.repo}/contents/${path}`;
}

async function fetchGitHubContent(path) {
  const url = `${githubFileUrl(path)}?ref=${encodeURIComponent(repoConfig.branch || "main")}`;
  const response = await fetch(url, { headers: githubHeaders() });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`GitHub read failed for ${path}: ${response.status} ${message}`);
  }
  const payload = await response.json();
  const text = Buffer.from(payload.content, "base64").toString("utf8");
  return {
    sha: payload.sha,
    text,
    payload,
  };
}

async function updateGitHubFile(path, content, sha, message) {
  const response = await fetch(githubFileUrl(path), {
    method: "PUT",
    headers: githubHeaders(),
    body: JSON.stringify({
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      sha,
      branch: repoConfig.branch || "main",
    }),
  });

  if (!response.ok) {
    const messageText = await response.text();
    throw new Error(`GitHub write failed for ${path}: ${response.status} ${messageText}`);
  }
  return response.json();
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftKey = `${left.date}|${left.start_time}|${left.title}|${left.id}`;
    const rightKey = `${right.date}|${right.start_time}|${right.title}|${right.id}`;
    return leftKey.localeCompare(rightKey);
  });
}

function recalculateSchedule(schedule) {
  const entries = sortEntries(schedule.entries || []);
  const dates = entries.map((entry) => entry.date).filter(Boolean);
  return {
    ...schedule,
    source: {
      ...schedule.source,
      lecture_count: entries.filter((entry) => entry.type === "lecture").length,
      event_count: entries.filter((entry) => entry.type === "event").length,
      subject_count: (schedule.subjects || []).length,
    },
    generated_at: new Date().toISOString().slice(0, 16),
    coverage: {
      start_date: dates.length ? dates[0] : null,
      end_date: dates.length ? dates[dates.length - 1] : null,
      months: [...new Set(dates.map((value) => value.slice(0, 7)))].sort(),
    },
    entries,
  };
}

function buildEventFromInput(input, schedule, existingEventId = "") {
  const subjectId = input.subjectId ? Number(input.subjectId) : null;
  const linkedSubject = (schedule.subjects || []).find((subject) => subject.id === subjectId) || null;
  const eventDate = input.date;
  const startTime = normalizeTime(input.startTime);
  const endTime = normalizeTime(input.endTime);
  const category = input.category || "general";
  const stableSlug = slugify(input.title) || "event";

  return {
    id: existingEventId || `event-admin-${Date.now()}`,
    raw_id: null,
    type: "event",
    date: eventDate,
    day_name: deriveDayName(eventDate),
    day_type: "",
    start_time: startTime,
    end_time: endTime,
    slot_label: slotLabelFor(startTime, schedule.slots),
    title: input.title,
    subject: linkedSubject,
    lecture_number: null,
    faculty: linkedSubject ? linkedSubject.faculty || "" : "",
    faculty_abbreviation: "",
    location: input.location || (linkedSubject ? linkedSubject.location || "" : ""),
    lecture_type: "",
    batch_division: "",
    attendance_tracked: false,
    schedule_status: "event",
    is_cancelled: false,
    is_extra: false,
    mandatory_label: "",
    stable_id: `SPECIAL|${category}|${subjectId || "global"}|admin|${stableSlug}|${eventDate}|${startTime}|${endTime}`,
    event_category: category,
    audience_scope: "all",
    audience_value: "",
    notes: input.notes || "",
    source: {
      sheet: "Admin Editor",
      cell: "",
    },
  };
}

function validateEventInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Missing event payload.");
  }
  if (!String(input.title || "").trim()) {
    throw new Error("Enter an event title.");
  }
  if (!String(input.date || "").trim()) {
    throw new Error("Choose an event date.");
  }
  if (!String(input.startTime || "").trim() || !String(input.endTime || "").trim()) {
    throw new Error("Choose both start and end time.");
  }
  if (normalizeTime(input.startTime) >= normalizeTime(input.endTime)) {
    throw new Error("End time must be later than start time.");
  }
}

function applyScheduleAction(schedule, action, eventInput, eventId) {
  const entries = [...(schedule.entries || [])];

  if (action === "add") {
    validateEventInput(eventInput);
    const event = buildEventFromInput(eventInput, schedule);
    entries.push(event);
    return {
      schedule: recalculateSchedule({ ...schedule, entries }),
      eventTitle: event.title,
    };
  }

  const existingIndex = entries.findIndex((entry) => entry.id === eventId || entry.id === eventInput?.id);
  if (existingIndex === -1) {
    throw new Error("That event could not be found in schedule.json.");
  }
  if (entries[existingIndex].type !== "event") {
    throw new Error("Only event entries can be edited or deleted from this admin page.");
  }

  if (action === "delete") {
    const removed = entries.splice(existingIndex, 1)[0];
    return {
      schedule: recalculateSchedule({ ...schedule, entries }),
      eventTitle: removed.title,
    };
  }

  if (action === "edit") {
    validateEventInput(eventInput);
    const original = entries[existingIndex];
    const updated = buildEventFromInput(eventInput, schedule, original.id);
    entries.splice(existingIndex, 1, updated);
    return {
      schedule: recalculateSchedule({ ...schedule, entries }),
      eventTitle: updated.title,
    };
  }

  throw new Error(`Unsupported action: ${action}`);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        Allow: "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Use POST for this endpoint." });
  }

  try {
    assertRuntimeConfig();

    const body = JSON.parse(event.body || "{}");
    const password = String(body.password || "");
    if (password !== process.env.ADMIN_PASSWORD) {
      return jsonResponse(401, { error: "Incorrect admin password." });
    }

    const action = String(body.action || "");
    if (!action) {
      return jsonResponse(400, { error: "Missing action." });
    }

    const scheduleFile = await fetchGitHubContent(repoConfig.schedulePath);
    const embeddedFile = await fetchGitHubContent(repoConfig.embeddedPath);
    const schedule = JSON.parse(scheduleFile.text);

    if (action === "list") {
      return jsonResponse(200, {
        ok: true,
        schedule,
      });
    }

    const result = applyScheduleAction(schedule, action, body.event, body.eventId);
    const updatedScheduleText = `${JSON.stringify(result.schedule, null, 2)}\n`;
    const updatedEmbeddedText = `window.__STATIC_SCHEDULE_DATA__ = ${JSON.stringify(result.schedule, null, 2)};\n`;
    const verb =
      action === "add" ? "added" :
      action === "edit" ? "edited" :
      "deleted";

    const firstCommit = await updateGitHubFile(
      repoConfig.schedulePath,
      updatedScheduleText,
      scheduleFile.sha,
      `Update schedule: ${verb} ${result.eventTitle}`
    );

    const secondCommit = await updateGitHubFile(
      repoConfig.embeddedPath,
      updatedEmbeddedText,
      embeddedFile.sha,
      `Sync embedded schedule data after ${verb} ${result.eventTitle}`
    );

    return jsonResponse(200, {
      ok: true,
      message: `Event ${verb} and committed to GitHub.`,
      schedule: result.schedule,
      commits: [
        firstCommit.commit?.html_url || null,
        secondCommit.commit?.html_url || null,
      ].filter(Boolean),
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error.message || "Unexpected serverless function error.",
    });
  }
};
