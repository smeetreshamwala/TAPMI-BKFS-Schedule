const loginEls = {
  form: document.getElementById("login-form"),
  input: document.getElementById("student-code-input"),
  error: document.getElementById("login-error"),
};

async function initLoginPage() {
  const directory = await window.SiteCommon.loadStudentDirectory();
  const existingStudent = window.SiteCommon.getLoggedInStudent(directory);
  if (existingStudent) {
    window.location.href = "./today.html";
    return;
  }

  loginEls.form.addEventListener("submit", (event) => {
    event.preventDefault();
    const inputValue = loginEls.input.value;
    const normalizedCode = window.SiteCommon.normalizeStudentCode(inputValue);

    if (!window.SiteCommon.isValidStudentCode(normalizedCode)) {
      loginEls.error.textContent = "Enter a valid student code in the format 25B###.";
      loginEls.input.setAttribute("aria-invalid", "true");
      return;
    }

    const student = window.SiteCommon.getStudentByCode(directory, normalizedCode);
    if (!student) {
      loginEls.error.textContent = "That code was not found in the student roster.";
      loginEls.input.setAttribute("aria-invalid", "true");
      return;
    }

    window.SiteCommon.storeStudentCode(student.student_code);
    loginEls.error.textContent = "";
    loginEls.input.removeAttribute("aria-invalid");
    window.location.href = "./today.html";
  });
}

initLoginPage().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell login-shell">
      <section class="panel login-panel">
        <p class="eyebrow">Student Login</p>
        <h1>Could not load the roster</h1>
        <p class="hero-copy">${error.message}</p>
      </section>
    </main>
  `;
});
