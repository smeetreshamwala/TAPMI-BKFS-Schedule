const adminState = {
  password: "",
  schedule: null,
  editingId: "",
};

const adminEls = {
  authPanel: document.getElementById("auth-panel"),
  editorPanel: document.getElementById("editor-panel"),
  authForm: document.getElementById("auth-form"),
  passwordInput: document.getElementById("password-input"),
  eventForm: document.getElementById("event-form"),
  formHeading: document.getElementById("form-heading"),
  eventId: document.getElementById("event-id"),
  titleInput: document.getElementById("title-input"),
  dateInput: document.getElementById("date-input"),
  startTimeInput: document.getElementById("start-time-input"),
  endTimeInput: document.getElementById("end-time-input"),
  categoryInput: document.getElementById("category-input"),
  subjectInput: document.getElementById("subject-input"),
  locationInput: document.getElementById("location-input"),
  notesInput: document.getElementById("notes-input"),
  cancelEditButton: document.getElementById("cancel-edit-button"),
  refreshButton: document.getElementById("refresh-button"),
  signoutButton: document.getElementById("signout-button"),
  statusBanner: document.getElementById("status-banner"),
  eventList: document.getElementById("event-list"),
  eventCountHeading: document.getElementById("event-count-heading"),
  eventRowTemplate: document.getElementById("event-row-template"),
};

function adminApiUrl() {
  return "/.netlify/functions/update-schedule";
}

function showStatus(message, tone = "info") {
  adminEls.statusBanner.textContent = message;
  adminEls.statusBanner.className = `status-banner ${tone}`;
}

function hideStatus() {
  adminEls.statusBanner.textContent = "";
  adminEls.statusBanner.className = "status-banner is-hidden";
}

async function callAdminApi(body) {
  const response = await fetch(adminApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

function subjectOptions() {
  return adminState.schedule?.subjects || [];
}

function populateSubjectOptions() {
  adminEls.subjectInput.innerHTML = '<option value="">No linked subject</option>';
  for (const subject of subjectOptions()) {
    const option = document.createElement("option");
    option.value = String(subject.id);
    option.textContent = `${subject.name}${subject.code ? ` (${subject.code})` : ""}`;
    adminEls.subjectInput.appendChild(option);
  }
}

function currentEvents() {
  return (adminState.schedule?.entries || [])
    .filter((entry) => entry.type === "event")
    .sort((a, b) => `${a.date}${a.start_time}${a.title}`.localeCompare(`${b.date}${b.start_time}${b.title}`));
}

function formatEventMeta(event) {
  const parts = [`${event.date} · ${event.start_time} - ${event.end_time}`];
  if (event.subject?.name) {
    parts.push(event.subject.name);
  }
  if (event.location) {
    parts.push(event.location);
  }
  return parts.join(" · ");
}

function resetForm() {
  adminState.editingId = "";
  adminEls.eventForm.reset();
  adminEls.eventId.value = "";
  adminEls.formHeading.textContent = "Add new event";
}

function fillForm(event) {
  adminState.editingId = event.id;
  adminEls.eventId.value = event.id;
  adminEls.titleInput.value = event.title || "";
  adminEls.dateInput.value = event.date || "";
  adminEls.startTimeInput.value = event.start_time || "";
  adminEls.endTimeInput.value = event.end_time || "";
  adminEls.categoryInput.value = event.event_category || "general";
  adminEls.subjectInput.value = event.subject?.id ? String(event.subject.id) : "";
  adminEls.locationInput.value = event.location || "";
  adminEls.notesInput.value = event.notes || "";
  adminEls.formHeading.textContent = `Edit event: ${event.title}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEventList() {
  const events = currentEvents();
  adminEls.eventList.innerHTML = "";
  adminEls.eventCountHeading.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "section-note";
    empty.textContent = "No editable events are in schedule.json yet. Add the first one from the form.";
    adminEls.eventList.appendChild(empty);
    return;
  }

  for (const event of events) {
    const fragment = adminEls.eventRowTemplate.content.cloneNode(true);
    fragment.querySelector(".event-row-title").textContent = event.title;
    fragment.querySelector(".event-row-chip").textContent = event.event_category || "general";
    fragment.querySelector(".event-row-meta").textContent = formatEventMeta(event);
    fragment.querySelector(".event-row-notes").textContent = event.notes || "";

    fragment.querySelector(".event-edit-button").addEventListener("click", () => {
      fillForm(event);
    });

    fragment.querySelector(".event-delete-button").addEventListener("click", async () => {
      const confirmed = window.confirm(`Delete "${event.title}" on ${event.date}?`);
      if (!confirmed) {
        return;
      }
      try {
        showStatus("Deleting event...", "info");
        const payload = await callAdminApi({
          action: "delete",
          password: adminState.password,
          eventId: event.id,
        });
        adminState.schedule = payload.schedule;
        populateSubjectOptions();
        renderEventList();
        resetForm();
        showStatus(payload.message || "Event deleted.", "success");
      } catch (error) {
        showStatus(error.message, "error");
      }
    });

    adminEls.eventList.appendChild(fragment);
  }
}

async function loadEditor() {
  showStatus("Loading events...", "info");
  const payload = await callAdminApi({
    action: "list",
    password: adminState.password,
  });
  adminState.schedule = payload.schedule;
  populateSubjectOptions();
  renderEventList();
  adminEls.authPanel.classList.add("is-hidden");
  adminEls.editorPanel.classList.remove("is-hidden");
  showStatus("Editor unlocked.", "success");
}

function eventPayloadFromForm() {
  return {
    id: adminEls.eventId.value.trim(),
    title: adminEls.titleInput.value.trim(),
    date: adminEls.dateInput.value,
    startTime: adminEls.startTimeInput.value,
    endTime: adminEls.endTimeInput.value,
    category: adminEls.categoryInput.value,
    subjectId: adminEls.subjectInput.value,
    location: adminEls.locationInput.value.trim(),
    notes: adminEls.notesInput.value.trim(),
  };
}

adminEls.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideStatus();
  adminState.password = adminEls.passwordInput.value;
  try {
    await loadEditor();
  } catch (error) {
    adminState.password = "";
    showStatus(error.message, "error");
  }
});

adminEls.eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const formEvent = eventPayloadFromForm();
    showStatus(adminState.editingId ? "Saving changes..." : "Adding event...", "info");
    const payload = await callAdminApi({
      action: adminState.editingId ? "edit" : "add",
      password: adminState.password,
      event: formEvent,
    });
    adminState.schedule = payload.schedule;
    populateSubjectOptions();
    renderEventList();
    resetForm();
    showStatus(payload.message || "Event saved.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  }
});

adminEls.cancelEditButton.addEventListener("click", () => {
  resetForm();
  hideStatus();
});

adminEls.refreshButton.addEventListener("click", async () => {
  try {
    await loadEditor();
  } catch (error) {
    showStatus(error.message, "error");
  }
});

adminEls.signoutButton.addEventListener("click", () => {
  adminState.password = "";
  adminState.schedule = null;
  resetForm();
  adminEls.passwordInput.value = "";
  adminEls.editorPanel.classList.add("is-hidden");
  adminEls.authPanel.classList.remove("is-hidden");
  showStatus("Editor locked.", "info");
});
