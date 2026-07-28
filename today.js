const todayEls = {
  studentName: document.getElementById("student-name"),
  studentCode: document.getElementById("student-code"),
  studentSection: document.getElementById("student-section"),
  studentCourseCount: document.getElementById("student-course-count"),
  studentNextClass: document.getElementById("student-next-class"),
  switchPersonButton: document.getElementById("switch-person-button"),
  todayHeading: document.getElementById("today-heading"),
  todayCount: document.getElementById("today-count"),
  lectureCount: document.getElementById("today-lecture-count"),
  eventCount: document.getElementById("today-event-count"),
  nextClassCard: document.getElementById("next-class-card"),
  todayAgenda: document.getElementById("today-agenda"),
};

async function initTodayPage() {
  const [schedule, directory] = await Promise.all([
    window.SiteCommon.loadScheduleData(),
    window.SiteCommon.loadStudentDirectory(),
  ]);

  const student = window.SiteCommon.requireLoggedInStudent(directory);
  if (!student) {
    return;
  }

  window.SiteCommon.hydrateStudentSummary({
    directory,
    schedule,
    student,
    nameElement: todayEls.studentName,
    codeElement: todayEls.studentCode,
    sectionElement: todayEls.studentSection,
    courseCountElement: todayEls.studentCourseCount,
    nextClassElement: todayEls.studentNextClass,
    switchButton: todayEls.switchPersonButton,
  });

  const today = window.SiteCommon.todayIso();
  const studentEntries = window.SiteCommon.getEntriesForStudent(schedule, student);
  const dayEntries = window.SiteCommon.getEntriesForDate(studentEntries, today);
  const nextEntry = window.SiteCommon.getNextUpcomingEntry(studentEntries);

  todayEls.todayHeading.textContent = window.SiteCommon.formatHumanDate(today);
  todayEls.todayCount.textContent = String(dayEntries.length);
  todayEls.lectureCount.textContent = String(dayEntries.filter((entry) => entry.type === "lecture").length);
  todayEls.eventCount.textContent = String(dayEntries.filter((entry) => entry.type === "event").length);
  todayEls.nextClassCard.textContent = nextEntry
    ? `${window.SiteCommon.formatHumanDate(nextEntry.date, { weekday: "short", month: "short" })} · ${nextEntry.start_time} · ${nextEntry.title}`
    : "No upcoming class";

  todayEls.todayAgenda.innerHTML = "";
  if (!dayEntries.length) {
    const empty = document.createElement("article");
    empty.className = "entry-card empty";
    empty.innerHTML = `
      <div class="entry-topline">
        <div>
          <h3 class="entry-title">No classes on this day</h3>
          <p class="entry-subline">The logged-in student has no classes or events on ${window.SiteCommon.formatHumanDate(today)}.</p>
        </div>
        <span class="entry-chip">Free day</span>
      </div>
    `;
    todayEls.todayAgenda.appendChild(empty);
    return;
  }

  dayEntries.forEach((entry) => {
    todayEls.todayAgenda.appendChild(window.SiteCommon.createAgendaCard(entry));
  });
}

initTodayPage().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <p class="eyebrow">Today</p>
        <h1>Could not load the TAPMI schedule</h1>
        <p class="hero-copy">${error.message}</p>
      </section>
    </main>
  `;
});
