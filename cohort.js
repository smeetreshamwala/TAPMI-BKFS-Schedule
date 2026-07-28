const cohortEls = {
  studentName: document.getElementById("student-name"),
  studentCode: document.getElementById("student-code"),
  studentSection: document.getElementById("student-section"),
  studentCourseCount: document.getElementById("student-course-count"),
  studentNextClass: document.getElementById("student-next-class"),
  switchPersonButton: document.getElementById("switch-person-button"),
  cohortCount: document.getElementById("cohort-count"),
  sectionCount: document.getElementById("section-count"),
  birthdayTableBody: document.getElementById("birthday-table-body"),
};

function formatBirthday(birthdayValue) {
  if (!birthdayValue) {
    return "—";
  }
  const parsed = new Date(birthdayValue);
  if (Number.isNaN(parsed.getTime())) {
    return String(birthdayValue);
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function initCohortPage() {
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
    nameElement: cohortEls.studentName,
    codeElement: cohortEls.studentCode,
    sectionElement: cohortEls.studentSection,
    courseCountElement: cohortEls.studentCourseCount,
    nextClassElement: cohortEls.studentNextClass,
    switchButton: cohortEls.switchPersonButton,
  });

  cohortEls.cohortCount.textContent = String(directory.students?.length || 0);
  cohortEls.sectionCount.textContent = String(directory.sections?.length || 0);

  const rows = (directory.students || [])
    .map((entry) => ({
      ...entry,
      daysLeft: window.SiteCommon.daysUntilNextBirthday(entry.birthday),
    }))
    .sort((left, right) => {
      const leftValue = left.daysLeft ?? Number.MAX_SAFE_INTEGER;
      const rightValue = right.daysLeft ?? Number.MAX_SAFE_INTEGER;
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
      return left.name.localeCompare(right.name);
    });

  cohortEls.birthdayTableBody.innerHTML = "";
  rows.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${formatBirthday(entry.birthday)}</td>
      <td>${entry.daysLeft == null ? "—" : entry.daysLeft}</td>
    `;
    cohortEls.birthdayTableBody.appendChild(row);
  });
}

initCohortPage().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <p class="eyebrow">Cohort</p>
        <h1>Could not load the cohort roster</h1>
        <p class="hero-copy">${error.message}</p>
      </section>
    </main>
  `;
});
