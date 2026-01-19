const form = document.getElementById("complaintForm");
const attachmentsInput = document.getElementById("attachments");
const notesContainer = document.getElementById("attachmentNotes");
const existingAttachmentsBox = document.getElementById("existingAttachments");

/* ============================================================
   EXTRACT COMPLAINT NUMBER & TOKEN
============================================================ */
const pathParts = window.location.pathname.split("/");
const complaintNumber = pathParts[pathParts.length - 1];
const token = new URLSearchParams(window.location.search).get("token");

/* ============================================================
   DETERMINE COMPLAINT TYPE
============================================================ */
function getComplaintType(number) {
  if (number.startsWith("HLT-")) return "health";
  if (number.startsWith("EDU-")) return "education";
  return null;
}

const complaintType = getComplaintType(complaintNumber);

if (!complaintNumber || !token || !complaintType) {
  UI.snackbar("Invalid or missing access link.", "error");
} else {
  verifyAccess();
}

/* ============================================================
   VERIFY ACCESS
============================================================ */
async function verifyAccess() {
  UI.showLoader(true);
  try {
    const res = await fetch(
      `/api/v1/complaints/${complaintType}/access/${complaintNumber}?token=${token}`
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      UI.snackbar(data.message || "Access denied.", "error");
      return;
    }

    const c = data.complaint;

    document.getElementById("complaintNumber").value = c.complaint_number;
    document.getElementById("complaintTitle").value = c.complaint_title;
    document.getElementById("complaintDescription").value =
      c.complaint_description || "";
    document.getElementById("complaintEmail").value =
      c.complainant_email || "";

    renderExistingAttachments(c.attachments || []);
    form.style.display = "block";
  } catch {
    UI.snackbar("Unable to connect to server.", "error");
  } finally {
    UI.showLoader(false);
  }
}

/* ============================================================
   RENDER EXISTING ATTACHMENTS
============================================================ */
function renderExistingAttachments(attachments) {
  existingAttachmentsBox.innerHTML = "";

  if (!attachments.length) {
    existingAttachmentsBox.innerHTML =
      "<div style='color:#6b7280'>No attachments uploaded yet.</div>";
    return;
  }

  attachments.forEach((a) => {
    const card = document.createElement("div");
    card.className = "attachment-card";

    card.innerHTML = `
      <img src="${a.url}" alt="attachment" />
      <div class="attachment-note">${a.note || "No note"}</div>
    `;

    existingAttachmentsBox.appendChild(card);
  });
}

/* ============================================================
   ATTACHMENT NOTES
============================================================ */
attachmentsInput.addEventListener("change", () => {
  notesContainer.innerHTML = "";

  Array.from(attachmentsInput.files).forEach((file) => {
    const div = document.createElement("div");
    div.style.marginTop = "10px";
    div.innerHTML = `
      <label>Note for "${file.name}"</label>
      <input type="text" placeholder="Optional note" />
    `;
    notesContainer.appendChild(div);
  });
});

/* ============================================================
   SUBMIT UPDATE
============================================================ */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  UI.showLoader(true);

  const formData = new FormData();
  formData.append(
    "complaint_description",
    document.getElementById("complaintDescription").value
  );

  const email = document.getElementById("complaintEmail").value;
  if (email) formData.append("complainant_email", email);

  const files = attachmentsInput.files;
  const noteInputs = notesContainer.querySelectorAll("input");

  for (let i = 0; i < files.length; i++) {
    formData.append("attachments", files[i]);
    formData.append("attachment_notes", noteInputs[i]?.value || "");
  }

  try {
    const res = await fetch(
      `/api/v1/complaints/${complaintType}/update/${complaintNumber}?token=${token}`,
      { method: "PATCH", body: formData }
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      UI.snackbar(data.message || "Update failed.", "error");
      return;
    }

    UI.snackbar("Complaint updated successfully.", "success");
    attachmentsInput.value = "";
    notesContainer.innerHTML = "";
    verifyAccess(); // reload updated data
  } catch {
    UI.snackbar("Failed to update complaint.", "error");
  } finally {
    UI.showLoader(false);
  }
});
