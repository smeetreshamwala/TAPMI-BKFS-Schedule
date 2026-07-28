const state = {
  schedule: null,
  monthCursor: null,
  selectedDate: null,
  subjectFilter: "all",
  viewMode: "mobile",
};

const els = {
  body: document.body,
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
  mobileViewButton: document.getElementById("mobile-view-button"),
  desktopViewButton: document.getElementById("desktop-view-button"),
  entryTemplate: document.getElementById("entry-template"),
};

const VIEW_MODE_STORAGE_KEY = "static-schedule-view-mode";

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

function format24HourLabel(hour) {
  if (hour === 24) {
    return "24:00";
  }
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getHourNumber(timeValue) {
  return Number.parseInt(String(timeValue || "0").split(":")[0], 10);
}

function timeToMinutes(timeValue) {
  const [hours, minutes] = String(timeValue || "00:00")
    .split(":")
    .map((value) => Number.parseInt(value, 10) || 0);
  return (hours * 60) + minutes;
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

function buildEntryCard(entry, options = {}) {
  const compact = Boolean(options.compact);

  if (compact) {
    const card = document.createElement("article");
    card.className = "entry-card timeline-entry-card";
    const durationMinutes = Math.max(timeToMinutes(entry.end_time) - timeToMinutes(entry.start_time), 15);
    card.classList.add(
      durationMinutes < 60 ? "is-short" :
      durationMinutes < 90 ? "is-medium" :
      "is-long"
    );
    if (entry.type === "event") {
      card.classList.add("is-event");
    }

    const subline =
      entry.type === "lecture"
        ? `Lecture ${entry.lecture_number}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`
        : `${entry.event_category || "event"}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`;

    const timingLine = `${entry.start_time} - ${entry.end_time}`;
    const detailBits = [entry.faculty || "Faculty not listed", entry.location || "Location not listed"];
    const showDetails = durationMinutes >= 90;
    const showSubline = durationMinutes >= 55;
    const statusText =
      entry.type === "event"
        ? (entry.event_category || "Event")
        : entry.is_cancelled
          ? "Cancelled"
          : entry.is_extra
            ? "Extra"
            : "";

    card.innerHTML = `
      <div class="timeline-entry-topline">
        <p class="timeline-entry-time">${timingLine}</p>
        ${statusText ? `<p class="timeline-entry-status">${statusText}</p>` : ""}
      </div>
      <h3 class="entry-title">${entry.title}</h3>
      ${showSubline ? `<p class="entry-subline">${subline}</p>` : ""}
      <p class="timeline-entry-meta">${showDetails ? detailBits.join(" · ") : subline}</p>
    `;
    return card;
  }

  const fragment = els.entryTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".entry-card");
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

  return card;
}

function buildEmptyTimelineState() {
  const empty = document.createElement("article");
  empty.className = "entry-card empty";
  empty.innerHTML = `
    <div class="entry-topline">
      <div>
        <h3 class="entry-title">No schedule on this date</h3>
        <p class="entry-subline">There are no lectures or events on ${formatHumanDate(state.selectedDate)}.</p>
      </div>
      <span class="entry-chip">Free day</span>
    </div>
  `;
  return empty;
}

function layoutTimelineEntries(entries) {
  const positioned = entries.map((entry) => {
    const startMinutes = timeToMinutes(entry.start_time);
    const endMinutes = Math.max(timeToMinutes(entry.end_time), startMinutes + 15);
    return {
      ...entry,
      startMinutes,
      endMinutes,
      lane: 0,
      laneCount: 1,
    };
  });

  positioned.sort((left, right) => {
    if (left.startMinutes !== right.startMinutes) {
      return left.startMinutes - right.startMinutes;
    }
    if (left.endMinutes !== right.endMinutes) {
      return right.endMinutes - left.endMinutes;
    }
    return left.title.localeCompare(right.title);
  });

  const clusters = [];
  for (const item of positioned) {
    const currentCluster = clusters[clusters.length - 1];
    if (!currentCluster || item.startMinutes >= currentCluster.endMinutes) {
      clusters.push({
        items: [item],
        endMinutes: item.endMinutes,
      });
      continue;
    }

    currentCluster.items.push(item);
    currentCluster.endMinutes = Math.max(currentCluster.endMinutes, item.endMinutes);
  }

  for (const cluster of clusters) {
    const laneEndTimes = [];
    let maxLanes = 0;

    for (const item of cluster.items) {
      let lane = laneEndTimes.findIndex((endMinutes) => endMinutes <= item.startMinutes);
      if (lane === -1) {
        lane = laneEndTimes.length;
        laneEndTimes.push(item.endMinutes);
      } else {
        laneEndTimes[lane] = item.endMinutes;
      }
      item.lane = lane;
      maxLanes = Math.max(maxLanes, laneEndTimes.length);
    }

    for (const item of cluster.items) {
      item.laneCount = maxLanes;
    }
  }

  return positioned;
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
  if (!dayEntries.length) {
    els.timeline.appendChild(buildEmptyTimelineState());
    return;
  }

  const shell = document.createElement("div");
  shell.className = "timeline-shell";

  const scale = document.createElement("div");
  scale.className = "timeline-scale";

  const canvas = document.createElement("div");
  canvas.className = "timeline-canvas";

  for (let hour = 0; hour <= 24; hour += 1) {
    const ratio = (hour / 24) * 100;

    const label = document.createElement("div");
    label.className = "timeline-scale-label";
    label.style.top = `${ratio}%`;
    label.textContent = format24HourLabel(hour);
    scale.appendChild(label);

    if (hour < 24) {
      const line = document.createElement("div");
      line.className = "timeline-hour-line";
      line.style.top = `${ratio}%`;
      canvas.appendChild(line);

      const halfHourLine = document.createElement("div");
      halfHourLine.className = "timeline-half-hour-line";
      halfHourLine.style.top = `${((hour + 0.5) / 24) * 100}%`;
      canvas.appendChild(halfHourLine);
    }
  }

  if (lunchSlot) {
    const lunchBand = document.createElement("div");
    lunchBand.className = "timeline-lunch-band";
    lunchBand.style.top = `${(timeToMinutes(lunchSlot.start_time) / (24 * 60)) * 100}%`;
    lunchBand.style.height = `${((timeToMinutes(lunchSlot.end_time) - timeToMinutes(lunchSlot.start_time)) / (24 * 60)) * 100}%`;
    lunchBand.innerHTML = `
      <span>Lunch Time</span>
      <small>${lunchSlot.start_time} - ${lunchSlot.end_time}</small>
    `;
    canvas.appendChild(lunchBand);
  }

  const positionedEntries = layoutTimelineEntries(dayEntries);
  for (const entry of positionedEntries) {
    const entryCard = buildEntryCard(entry, { compact: true });
    entryCard.classList.add("timeline-entry");

    const top = (entry.startMinutes / (24 * 60)) * 100;
    const height = ((entry.endMinutes - entry.startMinutes) / (24 * 60)) * 100;
    const laneWidth = 100 / entry.laneCount;
    const laneLeft = laneWidth * entry.lane;

    entryCard.style.top = `${top}%`;
    entryCard.style.height = `${height}%`;
    if (entry.laneCount === 1) {
      entryCard.style.left = "16px";
      entryCard.style.width = "min(620px, calc(100% - 32px))";
    } else {
      entryCard.style.left = `calc(${laneLeft}% + 8px)`;
      entryCard.style.width = `calc(${laneWidth}% - 16px)`;
    }

    canvas.appendChild(entryCard);
  }

  shell.appendChild(scale);
  shell.appendChild(canvas);
  els.timeline.appendChild(shell);
}

function render() {
  ensureSelectedDateStillVisible();
  renderCalendar();
  renderSubjects();
  renderTimeline();
}

function updateViewButtons() {
  const isMobile = state.viewMode === "mobile";
  els.mobileViewButton.classList.toggle("is-active", isMobile);
  els.desktopViewButton.classList.toggle("is-active", !isMobile);
  els.mobileViewButton.setAttribute("aria-pressed", String(isMobile));
  els.desktopViewButton.setAttribute("aria-pressed", String(!isMobile));
}

function applyViewMode(viewMode, persistPreference = true) {
  state.viewMode = viewMode === "desktop" ? "desktop" : "mobile";
  els.body.classList.toggle("mobile-view", state.viewMode === "mobile");
  els.body.classList.toggle("desktop-view", state.viewMode === "desktop");
  updateViewButtons();

  if (persistPreference) {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, state.viewMode);
    } catch (_error) {
      // Ignore localStorage failures and keep the current in-memory view mode.
    }
  }
}

function preferredViewMode() {
  try {
    const savedValue = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return savedValue === "desktop" ? "desktop" : "mobile";
  } catch (_error) {
    return "mobile";
  }
}

async function init() {
  applyViewMode(preferredViewMode(), false);

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

  els.mobileViewButton.addEventListener("click", () => {
    applyViewMode("mobile");
  });

  els.desktopViewButton.addEventListener("click", () => {
    applyViewMode("desktop");
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
