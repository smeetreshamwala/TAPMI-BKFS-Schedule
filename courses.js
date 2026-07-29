const coursesEls = {
  studentName: document.getElementById("student-name"),
  studentCode: document.getElementById("student-code"),
  studentSection: document.getElementById("student-section"),
  studentCourseCount: document.getElementById("student-course-count"),
  studentNextClass: document.getElementById("student-next-class"),
  switchPersonButton: document.getElementById("switch-person-button"),
  pageTitle: document.getElementById("courses-title"),
  pageNote: document.getElementById("courses-note"),
  coursesGrid: document.getElementById("courses-grid"),
  subjectDetailPanel: document.getElementById("subject-detail-panel"),
  subjectDetailTitle: document.getElementById("subject-detail-title"),
  subjectDetailNote: document.getElementById("subject-detail-note"),
  subjectLectureList: document.getElementById("subject-lecture-list"),
};

function renderLectureList(subject, subjectEntries) {
  const lectures = subjectEntries
    .filter((entry) => entry.type === "lecture")
    .sort((left, right) => `${left.date}${left.start_time}${left.title}`.localeCompare(`${right.date}${right.start_time}${right.title}`));

  coursesEls.subjectDetailTitle.textContent = `${subject.name} lecture list`;
  coursesEls.subjectDetailNote.textContent = lectures.length
    ? `${lectures.length} scheduled lecture${lectures.length === 1 ? "" : "s"} for ${subject.code || subject.name}.`
    : `No lectures are scheduled yet for ${subject.name}.`;
  coursesEls.subjectLectureList.innerHTML = "";

  if (!lectures.length) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "entry-card empty";
    emptyCard.innerHTML = `
      <h3 class="entry-title">No lectures scheduled</h3>
      <p class="subject-meta">This subject is mapped to the student, but there are no lecture rows in the current schedule data yet.</p>
    `;
    coursesEls.subjectLectureList.appendChild(emptyCard);
    return;
  }

  lectures.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "entry-card";
    card.innerHTML = `
      <div class="entry-topline">
        <div>
          <h3 class="entry-title">${entry.title}</h3>
          <p class="entry-subline">${window.SiteCommon.formatHumanDate(entry.date)} · Lecture ${entry.lecture_number}</p>
        </div>
        <span class="entry-chip">${entry.schedule_status || "scheduled"}</span>
      </div>
      <div class="entry-details">
        <div class="detail-group">
          <strong>Time</strong>
          <span>${window.SiteCommon.formatEntryWindow(entry)}</span>
        </div>
        <div class="detail-group">
          <strong>Faculty</strong>
          <span>${entry.faculty || "Faculty not listed"}</span>
        </div>
        <div class="detail-group">
          <strong>Location</strong>
          <span>${entry.location || "Location not listed"}</span>
        </div>
      </div>
    `;
    coursesEls.subjectLectureList.appendChild(card);
  });
}

async function initCoursesPage() {
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
    nameElement: coursesEls.studentName,
    codeElement: coursesEls.studentCode,
    sectionElement: coursesEls.studentSection,
    courseCountElement: coursesEls.studentCourseCount,
    nextClassElement: coursesEls.studentNextClass,
    switchButton: coursesEls.switchPersonButton,
  });

  const subjects = window.SiteCommon.getSubjectsForStudent(schedule, student);
  const studentEntries = window.SiteCommon.getEntriesForStudent(schedule, student);

  coursesEls.pageTitle.textContent = `${student.name}'s courses`;
  coursesEls.pageNote.textContent = "The page now reads from the logged-in student's mapped course list, so future elective differences can be handled only in data.";
  coursesEls.coursesGrid.innerHTML = "";

  subjects.forEach((subject) => {
    const subjectEntries = studentEntries.filter((entry) => entry.subject?.id === subject.id);
    const nextEntry = window.SiteCommon.getNextUpcomingEntry(subjectEntries);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "subject-card subject-select-card";
    card.innerHTML = `
      <h3>${subject.name}</h3>
      <p class="subject-meta">${subject.code || "No code"} · ${subject.credits} credits</p>
      <p class="subject-meta">${subject.faculty || "Faculty not listed"}</p>
      <p class="subject-meta">Mapped lectures: ${subjectEntries.length}</p>
      <p class="subject-meta">Next class: ${nextEntry ? `${nextEntry.date} · ${nextEntry.start_time}` : "No upcoming class"}</p>
    `;
    card.addEventListener("click", () => {
      coursesEls.coursesGrid.querySelectorAll(".subject-select-card").forEach((item) => item.classList.remove("is-selected"));
      card.classList.add("is-selected");
      renderLectureList(subject, subjectEntries);
      coursesEls.subjectDetailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    coursesEls.coursesGrid.appendChild(card);
  });
}

initCoursesPage().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <p class="eyebrow">Courses</p>
        <h1>Could not load the mapped courses</h1>
        <p class="hero-copy">${error.message}</p>
      </section>
    </main>
  `;
});
