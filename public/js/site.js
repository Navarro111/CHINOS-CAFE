import { db, BUSINESS_ID } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const form = document.getElementById("contactForm");
const statusBox = document.getElementById("contactStatus");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  statusBox.textContent = "Enviando mensaje...";
  statusBox.className = "status";

  const formData = new FormData(form);
  const payload = {
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    phone: formData.get("phone").trim(),
    subject: formData.get("subject").trim(),
    message: formData.get("message").trim(),
    branchId: formData.get("branchId"),
    status: "nuevo",
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, `businesses/${BUSINESS_ID}/contacts`), payload);
    form.reset();
    statusBox.textContent = "Mensaje enviado correctamente.";
    statusBox.className = "status success";
  } catch (error) {
    console.error(error);
    statusBox.textContent = "No se pudo guardar el mensaje.";
    statusBox.className = "status error";
  }
});
