const state = {
  schedule: null,
  monthCursor: null,
  selectedDate: null,
  subjectFilter: "all",
};

const els = {
  generatedAt: document.getElementById("generated-at"),
  coverageRange: document.getElementById("coverage-range"),
  entryCount: document.getElementById("entry-count"),
  monthLabel: document.getElementById("month-label"),
  calendarHeading: document.getElementById("calendar-heading"),
  selectedDayHeading: document.getElementById("selected-day-heading"),
  timelineHeading: document.getElementById("timeline-heading"),
  calendarGrid: document.getElementById("calendar-grid"),
  dayStats: document.getElementById("day-stats"),
  timeline: document.getElementById("timeline"),
  subjectFilter: document.getElementById("subject-filter"),
  subjectList: document.getElementById("subject-list"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  todayButton: document.getElementById("today-button"),
  entryTemplate: document.getElementById("entry-template"),
};

function formatHumanDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatMonthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatHourLabel(hour) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${suffix}`;
}

function getHourNumber(timeValue) {
  return Number.parseInt(String(timeValue || "0").split(":")[0], 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthKeyFromDate(isoDate) {
  return isoDate.slice(0, 7);
}

function parseMonthCursor(value) {
  const [year, month] = value.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function buildDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`);
}

function filteredEntries() {
  const entries = state.schedule.entries;
  if (state.subjectFilter === "all") {
    return entries;
  }
  return entries.filter((entry) => entry.subject && String(entry.subject.id) === state.subjectFilter);
}

function entriesByDate() {
  const map = new Map();
  for (const entry of filteredEntries()) {
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
    map.get(entry.date).push(entry);
  }
  return map;
}

function chooseInitialDate() {
  const dates = state.schedule.entries.map((entry) => entry.date).sort();
  const localToday = todayIso();
  if (dates.includes(localToday)) {
    return localToday;
  }
  return dates.find((date) => date >= localToday) || dates[0];
}

function ensureSelectedDateStillVisible() {
  const dateMap = entriesByDate();
  if (!dateMap.has(state.selectedDate)) {
    const availableDates = Array.from(dateMap.keys()).sort();
    state.selectedDate = availableDates[0] || state.selectedDate;
  }
}

function populateFilters() {
  for (const subject of state.schedule.subjects) {
    const option = document.createElement("option");
    option.value = String(subject.id);
    option.textContent = `${subject.name}${subject.code ? ` (${subject.code})` : ""}`;
    els.subjectFilter.appendChild(option);
  }
}

function renderMeta() {
  els.generatedAt.textContent = state.schedule.generated_at.replace("T", " ");
  els.coverageRange.textContent = `${state.schedule.coverage.start_date} to ${state.schedule.coverage.end_date}`;
  els.entryCount.textContent = `${state.schedule.source.lecture_count} lectures + ${state.schedule.source.event_count} events`;
}

function renderSubjects() {
  els.subjectList.innerHTML = "";
  for (const subject of state.schedule.subjects) {
    const card = document.createElement("article");
    card.className = "subject-card";
    const nextEntry = filteredEntries().find(
      (entry) => entry.subject && entry.subject.id === subject.id && entry.date >= state.selectedDate
    );
    card.innerHTML = `
      <h3>${subject.name}</h3>
      <p class="subject-meta">${subject.code || "No code"} · ${subject.credits} credits</p>
      <p class="subject-meta">${subject.faculty || "Faculty not listed"}</p>
      <p class="subject-meta">Range: ${subject.start_date} to ${subject.end_date}</p>
      <p class="subject-meta">Next visible: ${nextEntry ? `${nextEntry.date} ${nextEntry.start_time}` : "No matching entry"}</p>
    `;
    els.subjectList.appendChild(card);
  }
}

function renderCalendar() {
  const { year, monthIndex } = state.monthCursor;
  els.monthLabel.textContent = formatMonthLabel(year, monthIndex);
  els.calendarHeading.textContent = formatMonthLabel(year, monthIndex);
  els.calendarGrid.innerHTML = "";

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (const weekday of weekdays) {
    const cell = document.createElement("div");
    cell.className = "calendar-weekday";
    cell.textContent = weekday;
    els.calendarGrid.appendChild(cell);
  }

  const dateMap = entriesByDate();
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - startOffset);

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + i);
    const iso = current.toISOString().slice(0, 10);
    const entries = (dateMap.get(iso) || []).slice().sort((a, b) => {
      return `${a.start_time}${a.title}`.localeCompare(`${b.start_time}${b.title}`);
    });
    const isCurrentMonth = current.getMonth() === monthIndex;
    const isToday = iso === todayIso();
    const isSelected = iso === state.selectedDate;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-day${isCurrentMonth ? "" : " muted"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`;
    button.innerHTML = `
      <div class="day-head">
        <span class="day-number">${current.getDate()}</span>
        <span class="day-count">${entries.length || ""}</span>
      </div>
      <div class="dot-grid">
        ${entries
          .map((entry) => `<span class="dot${entry.type === "event" ? " event" : ""}"></span>`)
          .join("")}
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedDate = iso;
      state.monthCursor = { year: current.getFullYear(), monthIndex: current.getMonth() };
      render();
    });
    els.calendarGrid.appendChild(button);
  }
}

function renderDayStats(dayEntries) {
  const lectureCount = dayEntries.filter((entry) => entry.type === "lecture").length;
  const eventCount = dayEntries.filter((entry) => entry.type === "event").length;
  els.dayStats.innerHTML = `
    <article class="day-stat">
      <span class="stat-label">Day total</span>
      <strong>${dayEntries.length}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Lectures</span>
      <strong>${lectureCount}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Events</span>
      <strong>${eventCount}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Selected date</span>
      <strong>${state.selectedDate}</strong>
    </article>
  `;
}

function buildEntryCard(entry) {
  const fragment = els.entryTemplate.content.cloneNode(true);
  fragment.querySelector(".entry-title").textContent = entry.title;
  fragment.querySelector(".entry-subline").textContent =
    entry.type === "lecture"
      ? `Lecture ${entry.lecture_number}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`
      : `${entry.event_category || "event"}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`;

  const chip = fragment.querySelector(".entry-chip");
  chip.textContent =
    entry.type === "lecture"
      ? entry.is_cancelled
        ? "Cancelled"
        : entry.is_extra
          ? "Extra"
          : entry.schedule_status
      : entry.event_category || "event";
  if (entry.type === "event") {
    chip.classList.add("event");
  }

  const details = [
    ["Time", `${entry.start_time} - ${entry.end_time}`],
    ["Faculty", entry.faculty || "Not listed"],
    ["Location", entry.location || "Not listed"],
  ];
  if (entry.mandatory_label) {
    details.push(["Mandatory", entry.mandatory_label]);
  }
  if (entry.notes) {
    details.push(["Notes", entry.notes]);
  }

  fragment.querySelector(".entry-details").innerHTML = details
    .map(
      ([label, value]) => `
        <div class="detail-group">
          <strong>${label}</strong>
          <span>${value}</span>
        </div>
      `
    )
    .join("");

  return fragment;
}

function buildEmptyHourCard(hour) {
  const empty = document.createElement("article");
  empty.className = "entry-card empty compact";
  empty.innerHTML = `
    <div class="entry-topline">
      <div>
        <h3 class="entry-title">No scheduled item</h3>
        <p class="entry-subline">Nothing starts during the ${formatHourLabel(hour)} block.</p>
      </div>
      <span class="entry-chip">Free</span>
    </div>
  `;
  return empty;
}

function buildLunchCard() {
  const lunch = document.createElement("article");
  lunch.className = "entry-card lunch compact";
  lunch.innerHTML = `
    <div class="entry-topline">
      <div>
        <h3 class="entry-title">Lunch Time</h3>
        <p class="entry-subline">Compulsory break · 1:00 PM to 2:30 PM</p>
      </div>
      <span class="entry-chip">Break</span>
    </div>
  `;
  return lunch;
}

function renderTimeline() {
  const dayEntries = filteredEntries()
    .filter((entry) => entry.date === state.selectedDate)
    .sort((a, b) => `${a.start_time}${a.title}`.localeCompare(`${b.start_time}${b.title}`));

  els.selectedDayHeading.textContent = formatHumanDate(state.selectedDate);
  els.timelineHeading.textContent = formatHumanDate(state.selectedDate);
  renderDayStats(dayEntries);
  els.timeline.innerHTML = "";

  const lunchSlot = state.schedule.slots.find((slot) => slot.kind === "lunch");

  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("section");
    row.className = "timeline-row";
    const entries = dayEntries.filter((entry) => getHourNumber(entry.start_time) === hour);

    const time = document.createElement("div");
    time.className = "timeline-time";
    time.innerHTML = `
      <strong>${formatHourLabel(hour)}</strong>
      <span>${hour.toString().padStart(2, "0")}:00</span>
      <span>${(hour + 1).toString().padStart(2, "0")}:00</span>
    `;

    const rail = document.createElement("div");
    rail.className = "timeline-rail";
    rail.innerHTML = `<span class="timeline-node"></span>`;

    const stack = document.createElement("div");
    stack.className = "slot-stack";

    if (lunchSlot && getHourNumber(lunchSlot.start_time) === hour) {
      stack.appendChild(buildLunchCard());
    }

    if (entries.length) {
      for (const entry of entries) {
        stack.appendChild(buildEntryCard(entry));
      }
    }

    if (!stack.children.length) {
      stack.appendChild(buildEmptyHourCard(hour));
    }

    row.appendChild(time);
    row.appendChild(rail);
    row.appendChild(stack);
    els.timeline.appendChild(row);
  }
}

function render() {
  ensureSelectedDateStillVisible();
  renderCalendar();
  renderSubjects();
  renderTimeline();
}

async function init() {
  if (window.__STATIC_SCHEDULE_DATA__) {
    state.schedule = window.__STATIC_SCHEDULE_DATA__;
  } else {
    const response = await fetch("./schedule.json");
    if (!response.ok) {
      throw new Error(`Could not load schedule.json (${response.status})`);
    }

    state.schedule = await response.json();
  }
  state.selectedDate = chooseInitialDate();
  state.monthCursor = parseMonthCursor(monthKeyFromDate(state.selectedDate));
  renderMeta();
  populateFilters();
  render();

  els.subjectFilter.addEventListener("change", (event) => {
    state.subjectFilter = event.target.value;
    render();
  });

  els.prevMonth.addEventListener("click", () => {
    const next = new Date(state.monthCursor.year, state.monthCursor.monthIndex - 1, 1);
    state.monthCursor = { year: next.getFullYear(), monthIndex: next.getMonth() };
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    const next = new Date(state.monthCursor.year, state.monthCursor.monthIndex + 1, 1);
    state.monthCursor = { year: next.getFullYear(), monthIndex: next.getMonth() };
    renderCalendar();
  });

  els.todayButton.addEventListener("click", () => {
    state.selectedDate = chooseInitialDate();
    state.monthCursor = parseMonthCursor(monthKeyFromDate(state.selectedDate));
    render();
  });
}

init().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <p class="eyebrow">Static Schedule Snapshot</p>
        <h1>Could not load schedule data</h1>
        <p class="hero-copy">${error.message}</p>
        <p class="hero-copy">If you regenerated the site, make sure <code>schedule-data.js</code> exists next to <code>index.html</code>. A local server like <code>python -m http.server</code> still works too.</p>
      </section>
    </main>
  `;
});
