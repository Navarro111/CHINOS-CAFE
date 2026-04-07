import { auth, db, BUSINESS_ID } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const userBadge = document.getElementById("userBadge");
const logoutBtn = document.getElementById("logoutBtn");

const kpiProducts = document.getElementById("kpiProducts");
const kpiSuppliers = document.getElementById("kpiSuppliers");
const kpiSales = document.getElementById("kpiSales");

const productForm = document.getElementById("productForm");
const supplierForm = document.getElementById("supplierForm");
const inventoryForm = document.getElementById("inventoryForm");
const saleForm = document.getElementById("saleForm");

const productStatus = document.getElementById("productStatus");
const supplierStatus = document.getElementById("supplierStatus");
const inventoryStatus = document.getElementById("inventoryStatus");
const saleStatus = document.getElementById("saleStatus");

const productsTable = document.getElementById("productsTable");
const suppliersTable = document.getElementById("suppliersTable");
const inventoryTable = document.getElementById("inventoryTable");
const salesTable = document.getElementById("salesTable");
const receiptBox = document.getElementById("receiptBox");

const inventoryBranch = document.getElementById("inventoryBranch");
const inventoryViewBranch = document.getElementById("inventoryViewBranch");
const saleBranch = document.getElementById("saleBranch");

const inventoryProduct = document.getElementById("inventoryProduct");
const saleProduct = document.getElementById("saleProduct");

let currentUser = null;
let currentProfile = null;
let branches = [];
let products = [];
let suppliers = [];
let unsubscribeInventory = null;

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "./login.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  currentUser = user;

  const profileRef = doc(db, `businesses/${BUSINESS_ID}/users/${user.uid}`);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    alert("Tu usuario existe en Authentication, pero no tiene perfil en Firestore.");
    await signOut(auth);
    window.location.href = "./login.html";
    return;
  }

  currentProfile = profileSnap.data();
  userBadge.textContent = `${currentProfile.name || user.email} · ${currentProfile.role}`;

  bindForms();
  subscribeBranches();
  subscribeProducts();
  subscribeSuppliers();
  subscribeSales();
});

function bindForms() {
  productForm.addEventListener("submit", saveProduct);
  supplierForm.addEventListener("submit", saveSupplier);
  inventoryForm.addEventListener("submit", saveInventoryMovement);
  saleForm.addEventListener("submit", registerSale);
  inventoryViewBranch.addEventListener("change", subscribeInventoryByBranch);
}

function branchName(branchId) {
  return branches.find(b => b.id === branchId)?.name || branchId;
}

function productData(productId) {
  return products.find(p => p.id === productId);
}

function renderBranchOptions() {
  const options = branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
  inventoryBranch.innerHTML = options;
  inventoryViewBranch.innerHTML = options;
  saleBranch.innerHTML = options;
}

function renderProductOptions() {
  const options = products.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
  inventoryProduct.innerHTML = options;
  saleProduct.innerHTML = options;
}

function subscribeBranches() {
  const ref = collection(db, `businesses/${BUSINESS_ID}/branches`);
  onSnapshot(ref, (snapshot) => {
    branches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderBranchOptions();
    if (branches.length > 0) subscribeInventoryByBranch();
  });
}

function subscribeProducts() {
  const ref = collection(db, `businesses/${BUSINESS_ID}/products`);
  onSnapshot(ref, (snapshot) => {
    products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    kpiProducts.textContent = products.length;
    renderProductOptions();

    productsTable.innerHTML = products.map(p => `
      <tr>
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${p.sku}</td>
        <td>${Number(p.price).toFixed(2)}</td>
        <td>${Number(p.cost).toFixed(2)}</td>
        <td>${p.stockMin}</td>
      </tr>
    `).join("");
  });
}

function subscribeSuppliers() {
  const ref = collection(db, `businesses/${BUSINESS_ID}/suppliers`);
  onSnapshot(ref, (snapshot) => {
    suppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    kpiSuppliers.textContent = suppliers.length;

    suppliersTable.innerHTML = suppliers.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${s.phone || "-"}</td>
        <td>${s.email || "-"}</td>
        <td>${s.address || "-"}</td>
      </tr>
    `).join("");
  });
}

function subscribeSales() {
  const ref = query(
    collection(db, `businesses/${BUSINESS_ID}/sales`),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  onSnapshot(ref, (snapshot) => {
    const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    kpiSales.textContent = sales.length;

    salesTable.innerHTML = sales.map(s => `
      <tr>
        <td>${s.invoiceNumber}</td>
        <td>${branchName(s.branchId)}</td>
        <td>${Number(s.total).toFixed(2)}</td>
        <td>${s.paymentMethod}</td>
      </tr>
    `).join("");
  });
}

function subscribeInventoryByBranch() {
  const branchId = inventoryViewBranch.value || inventoryBranch.value;
  if (!branchId) return;

  if (unsubscribeInventory) unsubscribeInventory();

  const ref = collection(db, `businesses/${BUSINESS_ID}/branches/${branchId}/inventory`);
  unsubscribeInventory = onSnapshot(ref, (snapshot) => {
    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    inventoryTable.innerHTML = rows.map(row => {
      const product = productData(row.productId);
      return `
        <tr>
          <td>${product?.name || row.productId}</td>
          <td>${product?.sku || "-"}</td>
          <td>${row.stock ?? 0}</td>
          <td>${product?.stockMin ?? 0}</td>
        </tr>
      `;
    }).join("");
  });
}

async function saveProduct(e) {
  e.preventDefault();
  productStatus.textContent = "Guardando producto...";
  productStatus.className = "status";

  const payload = {
    name: document.getElementById("productName").value.trim(),
    category: document.getElementById("productCategory").value.trim(),
    sku: document.getElementById("productSku").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    cost: Number(document.getElementById("productCost").value),
    stockMin: Number(document.getElementById("productStockMin").value),
    active: true,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, `businesses/${BUSINESS_ID}/products`), payload);
    productForm.reset();
    productStatus.textContent = "Producto guardado.";
    productStatus.className = "status success";
  } catch (error) {
    console.error(error);
    productStatus.textContent = "Error al guardar el producto.";
    productStatus.className = "status error";
  }
}

async function saveSupplier(e) {
  e.preventDefault();
  supplierStatus.textContent = "Guardando proveedor...";
  supplierStatus.className = "status";

  const payload = {
    name: document.getElementById("supplierName").value.trim(),
    phone: document.getElementById("supplierPhone").value.trim(),
    email: document.getElementById("supplierEmail").value.trim(),
    address: document.getElementById("supplierAddress").value.trim(),
    notes: document.getElementById("supplierNotes").value.trim(),
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, `businesses/${BUSINESS_ID}/suppliers`), payload);
    supplierForm.reset();
    supplierStatus.textContent = "Proveedor guardado.";
    supplierStatus.className = "status success";
  } catch (error) {
    console.error(error);
    supplierStatus.textContent = "Error al guardar el proveedor.";
    supplierStatus.className = "status error";
  }
}

async function saveInventoryMovement(e) {
  e.preventDefault();
  inventoryStatus.textContent = "Actualizando inventario...";
  inventoryStatus.className = "status";

  const branchId = inventoryBranch.value;
  const productId = inventoryProduct.value;
  const movementType = document.getElementById("inventoryType").value;
  const qty = Number(document.getElementById("inventoryQty").value);

  if (!branchId || !productId || qty <= 0) {
    inventoryStatus.textContent = "Datos de inventario inválidos.";
    inventoryStatus.className = "status error";
    return;
  }

  const inventoryRef = doc(
    db,
    `businesses/${BUSINESS_ID}/branches/${branchId}/inventory/${productId}`
  );

  const movementRef = doc(
    collection(db, `businesses/${BUSINESS_ID}/inventoryMovements`)
  );

  try {
    await runTransaction(db, async (tx) => {
      const inventorySnap = await tx.get(inventoryRef);
      const currentStock = inventorySnap.exists() ? Number(inventorySnap.data().stock || 0) : 0;
      const newStock = movementType === "ajuste" ? qty : currentStock + qty;

      tx.set(inventoryRef, {
        productId,
        stock: newStock,
        updatedAt: serverTimestamp()
      }, { merge: true });

      tx.set(movementRef, {
        branchId,
        productId,
        movementType,
        qty,
        previousStock: currentStock,
        newStock,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
      });
    });

    inventoryForm.reset();
    renderProductOptions();
    renderBranchOptions();
    inventoryStatus.textContent = "Inventario actualizado correctamente.";
    inventoryStatus.className = "status success";
  } catch (error) {
    console.error(error);
    inventoryStatus.textContent = "No se pudo actualizar el inventario.";
    inventoryStatus.className = "status error";
  }
}

function invoiceNumber() {
  return `FAC-${Date.now()}`;
}

async function registerSale(e) {
  e.preventDefault();
  saleStatus.textContent = "Registrando venta...";
  saleStatus.className = "status";

  const branchId = saleBranch.value;
  const productId = saleProduct.value;
  const qty = Number(document.getElementById("saleQty").value);
  const paymentMethod = document.getElementById("salePayment").value;
  const customerName = document.getElementById("saleCustomer").value.trim();

  if (!branchId || !productId || qty <= 0) {
    saleStatus.textContent = "Datos de venta inválidos.";
    saleStatus.className = "status error";
    return;
  }

  const productRef = doc(db, `businesses/${BUSINESS_ID}/products/${productId}`);
  const inventoryRef = doc(db, `businesses/${BUSINESS_ID}/branches/${branchId}/inventory/${productId}`);
  const saleRef = doc(collection(db, `businesses/${BUSINESS_ID}/sales`));

  try {
    const result = await runTransaction(db, async (tx) => {
      const productSnap = await tx.get(productRef);
      const inventorySnap = await tx.get(inventoryRef);

      if (!productSnap.exists()) throw new Error("Producto no encontrado.");

      const product = productSnap.data();
      const stock = inventorySnap.exists() ? Number(inventorySnap.data().stock || 0) : 0;

      if (stock < qty) {
        throw new Error("Stock insuficiente.");
      }

      const subtotal = Number(product.price) * qty;
      const tax = 0;
      const total = subtotal + tax;
      const invoice = invoiceNumber();

      tx.set(saleRef, {
        invoiceNumber: invoice,
        branchId,
        cashierId: currentUser.uid,
        cashierName: currentProfile.name || currentUser.email,
        customerName: customerName || "Consumidor final",
        paymentMethod,
        subtotal,
        tax,
        total,
        items: [
          {
            productId,
            name: product.name,
            qty,
            price: Number(product.price),
            subtotal
          }
        ],
        createdAt: serverTimestamp()
      });

      tx.set(inventoryRef, {
        productId,
        stock: stock - qty,
        updatedAt: serverTimestamp()
      }, { merge: true });

      return {
        invoice,
        branchId,
        productName: product.name,
        qty,
        unitPrice: Number(product.price),
        total,
        paymentMethod,
        customerName: customerName || "Consumidor final"
      };
    });

    saleForm.reset();
    saleStatus.textContent = "Venta registrada correctamente.";
    saleStatus.className = "status success";

    receiptBox.innerHTML = `
      <strong>CHINOS CAFE</strong><br>
      Factura/Comprobante: <strong>${result.invoice}</strong><br>
      Sucursal: ${branch
