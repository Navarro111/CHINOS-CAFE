import { auth, db, BUSINESS_ID } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const form = document.getElementById("loginForm");
const statusBox = document.getElementById("loginStatus");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const profileRef = doc(db, `businesses/${BUSINESS_ID}/users/${user.uid}`);
  const profileSnap = await getDoc(profileRef);

  if (profileSnap.exists()) {
    window.location.href = "./pos.html";
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  statusBox.textContent = "Validando acceso...";
  statusBox.className = "status";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    statusBox.textContent = "Acceso correcto. Redirigiendo...";
    statusBox.className = "status success";
    setTimeout(() => {
      window.location.href = "./pos.html";
    }, 600);
  } catch (error) {
    console.error(error);
    statusBox.textContent = "Correo o contraseña incorrectos.";
    statusBox.className = "status error";
  }
});
