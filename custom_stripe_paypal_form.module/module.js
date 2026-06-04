/***** CONFIG – endpoints & keys *****/
const API_BASE = "https://johnankerberg-api-managemet-9b367f1169c7.herokuapp.com/"; // Existing API (products, Stripe PI, PayPal update)
const STRIPE_PUBLISHABLE_KEY = "pk_live_bWcgiMf7qYzXupW1Mu9OaDmH"; // from Stripe dashboard (publishable)
const FORM_API_KEY = ""; // Optional: if existing backend enforces X-API-Key

// New subscription API (FastAPI app in this repo)
const SUBSCRIPTION_API_BASE = "https://woocommerce-subscriptions-api-a963dc6ad505.herokuapp.com";
const SUBSCRIPTION_API_KEY = "QvFRH-sTDIEMY7sNb91eoMIkPdOd9940psUCyp8jn7x4F1fjearbEB12afaO8Cp0"; // Must match INTAKE_API_KEY on subscription API
const CUSTOM_DONATION_SUBSCRIPTION_PRODUCT_ID = 69201;
const FIXED_DONATION_PRODUCT_ID_MAP = {
    30: 67049,
    50: 67057,
    100: 67063,
    500: 67067,
};

// Fallback subscription classification if API does not return is_subscription.
const SUBSCRIPTION_PRODUCT_IDS = []; // e.g. [123, 456]
const SUBSCRIPTION_SKUS = []; // e.g. ["SUB-MONTHLY", "SUB-ANNUAL"]

/* Build safe URLs (prevents double // when base URL ends with /) */
const API = (path) =>
    `${API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

const SUB_API = (path) =>
    `${SUBSCRIPTION_API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

/* -------- API (products only) -------- */
async function getProductsFromApi(formId) {
    const res = await fetch(API(`/form-management/forms/${formId}/products/`), {
        headers: { "Accept": "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json(); // expects { products: [...] }
}

/* -------- UI helpers -------- */
const money = n => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

/* Debounce helper so we don't thrash payment intent creation on every keystroke */
const debounce = (fn, wait = 400) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};

// Global canonical list of products so DOM rows can link back cleanly
let FORM_PRODUCTS = [];
let lastFormMetadataSignature = "";

const refreshPayments = (() => {
    const debounced = debounce((force = false) => {
        const meta = getFormFieldsMetadata();
        const signature = JSON.stringify(meta);
        if (!force && signature === lastFormMetadataSignature) return;
        lastFormMetadataSignature = signature;
        renderPayPalOneTime();
        mountStripePaymentElement();
    }, 1200);

    return (options = {}) => {
        debounced(options.force === true);
    };
})();

function renderProducts(products) {
    FORM_PRODUCTS = products;

    const area = document.querySelector(".product_area");
    if (!area) return;

    area.innerHTML = `<h3 class="matched_gift">All Gifts are Double Matched</h3>`;

    products.forEach((p, i) => {
        const row = document.createElement("div");
        row.className = "product_row";

        row.dataset.unit = String(p.price);
        row.dataset.index = String(i);
        row.dataset.sku = p.sku || "";
        row.dataset.productId = String(p.id);
        row.dataset.isSubscription = p.is_subscription ? "1" : "0";



        row.innerHTML = `
      <label class="product_left">
        <span class="product_name">${p.name}</span>
      </label>

      <div class="qty_stepper">
        <button type="button" class="qty_btn" aria-label="Decrease">–</button>
        <input type="number" value="0" min="0"/>
        <button type="button" class="qty_btn" aria-label="Increase">+</button>
      </div>

      <div class="product_price">${money(p.price)}</div>
    `;

        const minus = row.querySelector(".qty_btn:first-child");
        const plus = row.querySelector(".qty_btn:last-child");
        const qtyInput = row.querySelector('input[type="number"]');

        const clampQty = () => {
            let v = parseInt(qtyInput.value || "0", 10);
            if (Number.isNaN(v) || v < 0) v = 0;
            qtyInput.value = String(v);
        };

        minus.addEventListener("click", () => {
            let v = parseInt(qtyInput.value || "0", 10);
            if (Number.isNaN(v)) v = 0;
            v = Math.max(0, v - 1);
            qtyInput.value = String(v);
            calcTotals();
        });

        plus.addEventListener("click", () => {
            let v = parseInt(qtyInput.value || "0", 10);
            if (Number.isNaN(v)) v = 0;
            v = v + 1;
            qtyInput.value = String(v);
            calcTotals();
        });

        qtyInput.addEventListener("input", () => {
            clampQty();
            calcTotals();
        });

        area.appendChild(row);
    });

    calcTotals();
    wireDynamicFormListeners();
}

const wireDynamicFormListeners = (() => {
    let wired = false;
    return () => {
        if (wired) return;
        const formEl = document.getElementById("dynamic-form");
        if (!formEl) return;
        formEl.addEventListener("change", () => refreshPayments());
        wired = true;
    };
})();

function toggleCalendarOffer(amount) {
    const offer = document.getElementById("calendar-offer");
    if (!offer) return;
    if (amount >= 100) {
        offer.hidden = false;
    } else {
        offer.hidden = true;
        const no = offer.querySelector('input[name="want_calendar"][value="no"]');
        if (no) no.checked = true;
    }
}

function getCalendarSelected() {
    const picked = document.querySelector('input[name="want_calendar"]:checked');
    return picked ? (picked.value === "yes") : false;
}

function calcTotals() {
    const rows = document.querySelectorAll(".product_row");
    let subtotal = 0;
    rows.forEach(row => {
        const qty = parseInt(row.querySelector('input[type="number"]').value || "0", 10);
        if (!qty || qty <= 0) return;
        const unit = Number(row.dataset.unit || "0");
        subtotal += qty * unit;
    });

    const donationInput = document.getElementById("custom_donation");
    let donation = 0;
    if (donationInput) {
        const raw = String(donationInput.value || "").trim();
        const n = Number(raw);
        donation = Number.isFinite(n) && n > 0 ? n : 0;
    }

    const total = subtotal + donation;
    const donationEl = document.getElementById("donation_amount");
    document.getElementById("subtotal").textContent = money(subtotal);
    if (donationEl) donationEl.textContent = money(donation);
    document.getElementById("total_amount").textContent = money(total);

    toggleCalendarOffer(total);
}

/* -------- Boot -------- */
(async function bootstrap() {
    const formId = 1;
    const titleEl = document.getElementById("form-title");

    if (titleEl) {
        titleEl.textContent = "";
        titleEl.style.display = "none";
    }

    try {
        const apiData = await getProductsFromApi(formId);
        const products = (apiData.products || []).map(p => ({
            id: p.product_id,
            sku: p.sku,
            name: p.name,
            price: Number(p.price || 0),
            is_subscription: Boolean(p.is_subscription),
        })).sort((a, b) => a.price - b.price);
        renderProducts(products);
    } catch (e) {
        console.error(e);
        const formEl = document.getElementById("dynamic-form");
        if (titleEl) titleEl.textContent = "Error loading products";
        if (formEl) formEl.innerHTML = '<p style="color:#b91c1c">Could not load the products.</p>';
    }
})();

/***** Cart helpers *****/
function getCartItems() {
    const rows = [...document.querySelectorAll(".product_row")];

    return rows
        .map(r => {
            const idx = Number(r.dataset.index || "-1");
            const qty = parseInt(r.querySelector('input[type="number"]').value || "0", 10);
            if (!qty || qty <= 0) return null;
            const fallbackPrice = Number(r.dataset.unit || "0");

            const p = (idx >= 0 && idx < FORM_PRODUCTS.length)
                ? FORM_PRODUCTS[idx]
                : {
                    id: null,
                    sku: r.dataset.sku || "",
                    name: r.querySelector(".product_name").textContent.trim(),
                    price: fallbackPrice,
                    is_subscription: r.dataset.isSubscription === "1",
                };

            return {
                id: p.id,
                sku: p.sku,
                name: p.name,
                unit_price: p.price ?? fallbackPrice,
                quantity: qty,
                is_subscription: Boolean(p.is_subscription),
            };
        })
        .filter(Boolean);
}

function isSubscriptionProduct(item) {
    if (item.is_subscription) return true;
    if (SUBSCRIPTION_PRODUCT_IDS.includes(item.id)) return true;
    if (item.sku && SUBSCRIPTION_SKUS.includes(item.sku)) return true;
    return false;
}

function cartHasSubscription() {
    return Boolean(getSelectedSubscriptionProductId());
}

function getSubtotalNumber() {
    const t = document.getElementById("total_amount").textContent || "$0.00";
    return Number(String(t).replace(/[^0-9.]/g, "")) || 0;
}

function normalizeCountry(countryValue) {
    const raw = String(countryValue || "").trim().toUpperCase();
    if (!raw) return "US";
    if (raw === "USA" || raw === "UNITED STATES") return "US";
    return raw.slice(0, 2);
}

function getSelectedSubscriptionProductId() {
    const donationInput = document.getElementById("custom_donation");
    const donationAmount = Number(donationInput?.value || 0);
    if (Number.isFinite(donationAmount) && donationAmount > 0) {
        return CUSTOM_DONATION_SUBSCRIPTION_PRODUCT_ID;
    }

    const selectedItem = getCartItems().find((item) => item.quantity > 0);
    if (!selectedItem) return null;

    const fixedAmountProductId = FIXED_DONATION_PRODUCT_ID_MAP[selectedItem.unit_price];
    if (fixedAmountProductId) {
        return fixedAmountProductId;
    }

    if (selectedItem.id) {
        return selectedItem.id;
    }

    return null;
}

function getSelectedRecurringAmount() {
    const donationInput = document.getElementById("custom_donation");
    const donationAmount = Number(donationInput?.value || 0);
    if (Number.isFinite(donationAmount) && donationAmount > 0) {
        return donationAmount;
    }

    const cartItems = getCartItems().filter((item) => item.quantity > 0);
    if (cartItems.length === 0) return null;
    const total = cartItems.reduce((sum, item) => sum + (Number(item.unit_price || 0) * item.quantity), 0);
    return total > 0 ? total : null;
}

/***** Dynamic form → metadata helper *****/
function getFormFieldsMetadata() {
    const formEl = document.getElementById("dynamic-form");
    if (!formEl) return {};

    const meta = {};
    const fd = new FormData(formEl);

    fd.forEach((value, key) => {
        if (value == null) return;
        if (key === "csrfmiddlewaretoken") return;

        let v = typeof value === "string" ? value.trim() : String(value);
        if (!v) return;
        if (v.length > 500) v = v.slice(0, 500);

        meta[key] = v;
    });
    meta.opt_in_email = document.getElementById("opt_in_email")?.checked ? "yes" : "no";
    meta.opt_in_sms = document.getElementById("opt_in_sms")?.checked ? "yes" : "no";

    return meta;
}

/** Stripe Payment Element (custom checkout) */
let stripe;
let elements;
let paymentElement;
let currentClientSecret = null;

function getEmailFromForm() {
    const byType = document.querySelector('input[type="email"]');
    if (byType && byType.value) return byType.value.trim();
    const byName = document.querySelector('input[name="email"]');
    if (byName && byName.value) return byName.value.trim();
    return "";
}

function validateForm(showAlert = true) {
    const form = document.getElementById("dynamic-form");
    const requiredFields = [
        "first_name",
        "last_name",
        "email",
        "street_address",
        "city",
        "zip",
        "state_region",
        "country_region",
        "mobile_phone"
    ];

    let isValid = true;
    const errors = [];

    requiredFields.forEach(fieldName => {
        const field = form.elements[fieldName];
        if (!field || !field.value.trim()) {
            isValid = false;
            errors.push(fieldName.replace(/_/g, " "));
            if (field && showAlert) field.style.borderColor = "red";
        } else if (field && showAlert) {
            field.style.borderColor = "";
        }
    });

    const emailField = form.elements["email"];
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            isValid = false;
            errors.push("valid email");
            if (showAlert) emailField.style.borderColor = "red";
        }
    }

    if (!isValid && showAlert) {
        alert("Please fill out all required fields:\n- " + errors.join("\n- "));
    }

    return isValid;
}

async function mountStripePaymentElement() {
    const btn = document.getElementById("stripe-pay-button");
    const msg = document.getElementById("stripe-messages");
    const container = document.getElementById("payment-element");
    if (!container) return;

    const subtotal = getSubtotalNumber();
    msg.textContent = "";
    btn.disabled = true;

    if (subtotal <= 0) {
        container.innerHTML = "";
        msg.textContent = "Select a product to enter payment details.";
        return;
    }
    if (subtotal < 0.5) {
        container.innerHTML = "";
        msg.textContent = "Minimum total is $0.50.";
        return;
    }

    if (!validateForm(false)) {
        container.innerHTML = "";
        msg.textContent = "Please complete all required fields to continue.";
        return;
    }

    const amount = Math.round(subtotal * 100);
    const wantCalendar = getCalendarSelected();
    const email = getEmailFromForm();
    const items = getCartItems();
    const formMeta = getFormFieldsMetadata();

    const itemMeta = {};
    items.slice(0, 10).forEach((it, idx) => {
        const i = idx + 1;
        itemMeta[`item${i}_sku`] = it.sku || "";
        itemMeta[`item${i}_name`] = it.name || "";
        itemMeta[`item${i}_qty`] = String(it.quantity || 1);
        itemMeta[`item${i}_unit`] = String(Math.round((it.unit_price || 0) * 100));
    });

    try {
        const res = await fetch(API("/stripe/payment-intents/create/"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(FORM_API_KEY ? { "X-API-Key": FORM_API_KEY } : {})
            },
            body: JSON.stringify({
                amount,
                currency: "usd",
                email: email || undefined,
                metadata: {
                    want_calendar: wantCalendar ? "yes" : "no",
                    subtotal: subtotal.toFixed(2),
                    ...formMeta,
                    ...itemMeta,
                }
            })
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("PaymentIntent create failed. Status:", res.status, "Body:", data);
            msg.textContent = (data && (data.detail || data.error || data.message))
                ? (data.detail || data.error || data.message)
                : "Could not initialize payment. Please try again.";
            return;
        }

        currentClientSecret = data.client_secret;
        if (!stripe) stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

        try {
            paymentElement && paymentElement.unmount();
        } catch (_) {}

        elements = stripe.elements({ clientSecret: currentClientSecret });
        paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");
        btn.disabled = false;
    } catch (e) {
        console.error(e);
        msg.textContent = "Network error while initializing payment.";
    }
}

function buildSubscriptionIntakePayload(paymentIntent) {
    const formMeta = getFormFieldsMetadata();
    const productId = getSelectedSubscriptionProductId();
    const recurringAmount = getSelectedRecurringAmount();
    if (!productId) {
        throw new Error("No subscription product selected for intake.");
    }

    return {
        source: "custom_form",
        form_name: "atri-dynamic-form",
        external_submission_id: paymentIntent.id,
        email: formMeta.email || "",
        phone: formMeta.mobile_phone || null,
        billing_address: {
            first_name: formMeta.first_name || "",
            last_name: formMeta.last_name || "",
            address_1: formMeta.street_address || "",
            city: formMeta.city || "",
            state: formMeta.state_region || "",
            postcode: formMeta.zip || "",
            country: normalizeCountry(formMeta.country_region),
        },
        line_items: [
            {
                product_id: productId,
                quantity: 1,
            }
        ],
        payment_provider: "stripe",
        stripe_payment_method_id: paymentIntent.payment_method || "",
        stripe_payment_intent_id: paymentIntent.id || "",
        recurring_amount: recurringAmount ? recurringAmount.toFixed(2) : undefined,
        recurring_interval: recurringAmount ? "monthly" : undefined,
        metadata: {
            donation_amount: recurringAmount ? recurringAmount.toFixed(2) : "",
            heard_about_us: formMeta.heard_about_us || "",
            want_calendar: getCalendarSelected() ? "yes" : "no",
            opt_in_email: document.getElementById("opt_in_email")?.checked ? "yes" : "no",
            opt_in_sms: document.getElementById("opt_in_sms")?.checked ? "yes" : "no",
        },
    };
}

async function sendSubscriptionIntake(paymentIntent) {
    const payload = buildSubscriptionIntakePayload(paymentIntent);

    const res = await fetch(SUB_API("/api/v1/subscriptions/intake"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(SUBSCRIPTION_API_KEY ? { "X-API-Key": SUBSCRIPTION_API_KEY } : {}),
            "X-Idempotency-Key": `stripe-${paymentIntent.id}`,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Subscription intake failed (${res.status}): ${text}`);
    }

    return res.json().catch(() => ({}));
}

async function handleStripePayNow() {
    if (!validateForm(true)) return;

    const btn = document.getElementById("stripe-pay-button");
    const msg = document.getElementById("stripe-messages");
    if (!stripe || !elements) return;

    btn.disabled = true;
    msg.textContent = "Processing…";

    const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: "https://atriresearch.org/audio-bible-thank-you" },
        redirect: "if_required",
    });

    if (error) {
        console.error(error);
        msg.textContent = error.message || "Payment failed. Please check your details and try again.";
        btn.disabled = false;
        return;
    }

    const status = paymentIntent && paymentIntent.status;
    if (status === "succeeded") {
        try {
            // Only call subscription API when cart includes a subscription item.
            if (cartHasSubscription()) {
                await sendSubscriptionIntake(paymentIntent);
            }
            window.location.href = "https://atriresearch.org/audio-bible-thank-you";
        } catch (e) {
            console.error(e);
            msg.textContent = "Payment succeeded, but subscription setup failed. Our team has been notified.";
            btn.disabled = false;
        }
    } else if (status === "processing") {
        msg.textContent = "Your payment is processing. You will receive a confirmation shortly.";
    } else if (status === "requires_payment_method") {
        msg.textContent = "Payment failed. Please try another payment method.";
        btn.disabled = false;
    } else {
        msg.textContent = "Payment status: " + (status || "unknown") + ".";
        btn.disabled = false;
    }
}

async function sendPayPalOrderToBackend(details) {
    const formMeta = getFormFieldsMetadata();
    const emailOptIn = !!document.querySelector('input[name="opt_in_email"]')?.checked;
    const smsOptIn = !!document.querySelector('input[name="opt_in_sms"]')?.checked;

    const items = getCartItems().map(it => ({
        name: it.name,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: String(Math.round((it.unit_price || 0) * 100)),
    }));

    const donationInput = document.getElementById("custom_donation");
    let donation = 0;
    if (donationInput) {
        const raw = String(donationInput.value || "").trim();
        const n = Number(raw);
        donation = Number.isFinite(n) && n > 0 ? n : 0;
    }

    const total = getSubtotalNumber();
    const wantCalendar = getCalendarSelected();
    const heardAboutUs = formMeta.heard_about_us || "";

    const payer = details.payer || {};
    const payerName = payer.name || {};

    const email = formMeta.email || payer.email_address || "";
    const firstName = formMeta.first_name || payerName.given_name || "";
    const lastName = formMeta.last_name || payerName.surname || "";
    const phone = formMeta.mobile_phone || payer.phone?.phone_number?.national_number || "";

    const streetAddress = formMeta.street_address || "";
    const city = formMeta.city || "";
    const zip = formMeta.zip || "";
    const stateRegion = formMeta.state_region || "";
    const countryRegion = formMeta.country_region || "";

    const purchaseUnit = (details.purchase_units && details.purchase_units[0]) || {};
    const amountObj = purchaseUnit.amount || {};

    const currencyCode = amountObj.currency_code || "USD";
    const paypalOrderId = details.id;

    const payload = {
        paypal_order_id: paypalOrderId,
        total_amount: Number(total.toFixed(2)),
        currency: currencyCode,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        street_address: streetAddress,
        city,
        zip,
        state_region: stateRegion,
        country_region: countryRegion,
        heard_about_us: heardAboutUs,
        want_calendar: Boolean(wantCalendar),
        donation_amount: Number(donation.toFixed(2)),
        items,
        form_fields: formMeta,
        opt_in_email: emailOptIn,
        opt_in_sms: smsOptIn,
    };

    const res = await fetch(API("/paypal/paypal_update_hubspot/"), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(FORM_API_KEY ? { "X-API-Key": FORM_API_KEY } : {}),
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Backend PayPal capture endpoint failed:", res.status, text);
        throw new Error(`Backend PayPal capture failed with status ${res.status}`);
    }

    return res.json().catch(() => null);
}

/***** PAYPAL (one-time, client-side) *****/
function renderPayPalOneTime() {
    const container = document.getElementById("paypal-button-onetime");
    if (!container) return;

    container.style.display = "block";
    container.innerHTML = "";

    const amount = getSubtotalNumber();
    if (amount <= 0) {
        container.innerHTML = '<div style="opacity:.7;font-size:14px">Select a product to enable PayPal</div>';
        return;
    }

    if (typeof window.paypal === "undefined") {
        container.innerHTML = '<div style="opacity:.7;font-size:14px">Loading PayPal…</div>';
        return;
    }

    window.paypal.Buttons({
        style: { layout: "vertical", shape: "rect", label: "paypal" },
        onClick: function(data, actions) {
            if (!validateForm(true)) return actions.reject();
            return actions.resolve();
        },
        createOrder: (data, actions) => {
            const currentAmount = getSubtotalNumber();
            return actions.order.create({
                intent: "CAPTURE",
                purchase_units: [
                    {
                        amount: {
                            currency_code: "USD",
                            value: currentAmount.toFixed(2),
                        },
                    }
                ]
            });
        },
        onApprove: (data, actions) => {
            return actions.order.capture().then(async (details) => {
                try {
                    await sendPayPalOrderToBackend(details);
                } catch (err) {
                    console.error("Failed to send PayPal order to backend:", err);
                    alert("Your payment went through, but we had an issue saving your info. Our team will review it.");
                    return;
                }
                window.location.href = "https://atriresearch.org/audio-bible-thank-you";
            });
        },
        onError: (err) => {
            console.error(err);
            alert("PayPal error. Please try again.");
        }
    }).render("#paypal-button-onetime");
}

/***** Keep PayPal / Stripe in sync when totals or selection change *****/
const observeTotals = new MutationObserver(() => {
    refreshPayments({ force: true });
});
observeTotals.observe(document.getElementById("total_amount"), { childList: true, subtree: true, characterData: true });

document.addEventListener("change", (e) => {
    if (
        e.target.matches('.product_row input[type="number"]') ||
        e.target.matches('input[name="want_calendar"]')
    ) {
        refreshPayments({ force: true });
    }
});

/***** Mount payments when UI is ready *****/
window.addEventListener("load", () => {
    mountStripePaymentElement();
    renderPayPalOneTime();

    const btn = document.getElementById("stripe-pay-button");
    if (btn) btn.addEventListener("click", handleStripePayNow);

    const donationInput = document.getElementById("custom_donation");
    if (donationInput) donationInput.addEventListener("input", () => {
        calcTotals();
        refreshPayments({ force: true });
    });
});
