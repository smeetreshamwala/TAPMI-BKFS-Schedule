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
};

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

    const card = document.createElement("article");
    card.className = "subject-card";
    card.innerHTML = `
      <h3>${subject.name}</h3>
      <p class="subject-meta">${subject.code || "No code"} · ${subject.credits} credits</p>
      <p class="subject-meta">${subject.faculty || "Faculty not listed"}</p>
      <p class="subject-meta">Mapped lectures: ${subjectEntries.length}</p>
      <p class="subject-meta">Schedule pattern: ${subject.schedule_summary || "Pattern not listed"}</p>
      <p class="subject-meta">Next class: ${nextEntry ? `${nextEntry.date} · ${nextEntry.start_time}` : "No upcoming class"}</p>
    `;
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
