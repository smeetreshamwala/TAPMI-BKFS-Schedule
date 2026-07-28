const SiteCommon = (() => {
  const STUDENT_CODE_STORAGE_KEY = "tapmi-student-code";
  const STUDENT_CODE_PATTERN = /^25B\d{3}$/i;

  function localIsoDate(dateValue = new Date()) {
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function todayIso() {
    return localIsoDate(new Date());
  }

  function formatHumanDate(isoDate, options = {}) {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, {
      weekday: options.weekday ?? "long",
      month: options.month ?? "long",
      day: options.day ?? "numeric",
      year: options.year ?? "numeric",
    });
  }

  function formatMonthLabel(year, monthIndex) {
    return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }

  function timeToMinutes(timeValue) {
    const [hours, minutes] = String(timeValue || "00:00")
      .split(":")
      .map((value) => Number.parseInt(value, 10) || 0);
    return (hours * 60) + minutes;
  }

  function formatEntryWindow(entry) {
    return `${entry.start_time} - ${entry.end_time}`;
  }

  function normalizeStudentCode(value) {
    return String(value || "").trim().toUpperCase();
  }

  function isValidStudentCode(value) {
    return STUDENT_CODE_PATTERN.test(normalizeStudentCode(value));
  }

  function readStoredStudentCode() {
    try {
      return normalizeStudentCode(window.localStorage.getItem(STUDENT_CODE_STORAGE_KEY));
    } catch (_error) {
      return "";
    }
  }

  function storeStudentCode(studentCode) {
    try {
      window.localStorage.setItem(STUDENT_CODE_STORAGE_KEY, normalizeStudentCode(studentCode));
    } catch (_error) {
      // Ignore localStorage failures and keep current in-memory flow.
    }
  }

  function clearStoredStudentCode() {
    try {
      window.localStorage.removeItem(STUDENT_CODE_STORAGE_KEY);
    } catch (_error) {
      // Ignore localStorage failures.
    }
  }

  async function loadScheduleData() {
    if (window.__STATIC_SCHEDULE_DATA__) {
      return window.__STATIC_SCHEDULE_DATA__;
    }

    const response = await fetch("./schedule.json");
    if (!response.ok) {
      throw new Error(`Could not load schedule.json (${response.status})`);
    }
    return response.json();
  }

  async function loadStudentDirectory() {
    if (window.__STUDENT_DIRECTORY_DATA__) {
      return window.__STUDENT_DIRECTORY_DATA__;
    }

    const response = await fetch("./students.json");
    if (!response.ok) {
      throw new Error(`Could not load students.json (${response.status})`);
    }
    return response.json();
  }

  function getSectionMap(directory) {
    return new Map((directory.sections || []).map((section) => [section.id, section]));
  }

  function getStudentByCode(directory, studentCode) {
    const normalized = normalizeStudentCode(studentCode);
    return (directory.students || []).find((student) => student.student_code === normalized) || null;
  }

  function getLoggedInStudent(directory) {
    return getStudentByCode(directory, readStoredStudentCode());
  }

  function requireLoggedInStudent(directory) {
    const student = getLoggedInStudent(directory);
    if (!student) {
      window.location.href = "./index.html";
      return null;
    }
    return student;
  }

  function getSubjectsForStudent(schedule, student) {
    const courseIds = new Set(student.course_ids || []);
    return (schedule.subjects || []).filter((subject) => courseIds.has(subject.id));
  }

  function entryMatchesStudent(entry, student) {
    if (entry.type === "event") {
      if (!entry.subject) {
        return true;
      }
      return new Set(student.course_ids || []).has(entry.subject.id);
    }

    if (!entry.subject) {
      return true;
    }

    return new Set(student.course_ids || []).has(entry.subject.id);
  }

  function getEntriesForStudent(schedule, student) {
    return (schedule.entries || []).filter((entry) => entryMatchesStudent(entry, student));
  }

  function getEntriesForDate(entries, isoDate) {
    return entries
      .filter((entry) => entry.date === isoDate)
      .sort((left, right) => `${left.start_time}${left.title}`.localeCompare(`${right.start_time}${right.title}`));
  }

  function getNextUpcomingEntry(entries) {
    const now = new Date();
    const today = todayIso();
    const currentMinutes = (now.getHours() * 60) + now.getMinutes();

    return (
      entries.find((entry) => {
        if (entry.date > today) {
          return true;
        }
        if (entry.date < today) {
          return false;
        }
        return timeToMinutes(entry.end_time) >= currentMinutes;
      }) || null
    );
  }

  function createAgendaCard(entry) {
    const card = document.createElement("article");
    card.className = "entry-card agenda-entry";
    if (entry.type === "event") {
      card.classList.add("is-event");
    }

    const topMeta =
      entry.type === "lecture"
        ? `Lecture ${entry.lecture_number}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`
        : `${entry.event_category || "Event"}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`;

    const detailLine = [entry.faculty || "", entry.location || ""].filter(Boolean).join(" · ");

    card.innerHTML = `
      <div class="agenda-entry-time">${formatEntryWindow(entry)}</div>
      <div class="agenda-entry-body">
        <div class="entry-topline">
          <div>
            <h3 class="entry-title">${entry.title}</h3>
            <p class="entry-subline">${topMeta}</p>
          </div>
          <span class="entry-chip${entry.type === "event" ? " event" : ""}">${entry.type === "event" ? (entry.event_category || "Event") : entry.schedule_status}</span>
        </div>
        ${detailLine ? `<p class="subject-meta">${detailLine}</p>` : ""}
      </div>
    `;

    return card;
  }

  function hydrateStudentSummary({ directory, schedule, student, nameElement, codeElement, sectionElement, courseCountElement, nextClassElement, switchButton }) {
    const sectionMap = getSectionMap(directory);
    const studentSubjects = getSubjectsForStudent(schedule, student);
    const studentEntries = getEntriesForStudent(schedule, student);
    const nextEntry = getNextUpcomingEntry(studentEntries);

    if (nameElement) {
      nameElement.textContent = student.name;
    }
    if (codeElement) {
      codeElement.textContent = student.student_code;
    }
    if (sectionElement) {
      sectionElement.textContent = sectionMap.get(student.section_id)?.name || student.section_name || "Section not assigned";
    }
    if (courseCountElement) {
      courseCountElement.textContent = `${studentSubjects.length} subjects`;
    }
    if (nextClassElement) {
      nextClassElement.textContent = nextEntry
        ? `${formatHumanDate(nextEntry.date, { weekday: "short", month: "short" })} · ${nextEntry.start_time} · ${nextEntry.title}`
        : "No upcoming class";
    }
    if (switchButton) {
      switchButton.addEventListener("click", () => {
        clearStoredStudentCode();
        window.location.href = "./index.html";
      });
    }
  }

  function daysUntilNextBirthday(birthdayValue) {
    if (!birthdayValue) {
      return null;
    }

    const parsed = new Date(birthdayValue);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let nextBirthday = new Date(startOfToday.getFullYear(), parsed.getMonth(), parsed.getDate());
    if (nextBirthday < startOfToday) {
      nextBirthday = new Date(startOfToday.getFullYear() + 1, parsed.getMonth(), parsed.getDate());
    }

    return Math.round((nextBirthday.getTime() - startOfToday.getTime()) / 86400000);
  }

  return {
    loadScheduleData,
    loadStudentDirectory,
    localIsoDate,
    todayIso,
    formatHumanDate,
    formatMonthLabel,
    timeToMinutes,
    formatEntryWindow,
    normalizeStudentCode,
    isValidStudentCode,
    storeStudentCode,
    clearStoredStudentCode,
    getStudentByCode,
    getLoggedInStudent,
    requireLoggedInStudent,
    getSubjectsForStudent,
    getEntriesForStudent,
    getEntriesForDate,
    getNextUpcomingEntry,
    createAgendaCard,
    hydrateStudentSummary,
    daysUntilNextBirthday,
  };
})();

window.SiteCommon = SiteCommon;
