/***** CONFIG – endpoints & keys *****/
const API_BASE = "https://johnankerberg-api-managemet-9b367f1169c7.herokuapp.com/";
const STRIPE_PUBLISHABLE_KEY = "pk_live_bWcgiMf7qYzXupW1Mu9OaDmH";
const FORM_API_KEY = "";

const SUBSCRIPTION_API_BASE = "https://woocommerce-subscriptions-api-a963dc6ad505.herokuapp.com";
const SUBSCRIPTION_API_KEY = "QvFRH-sTDIEMY7sNb91eoMIkPdOd9940psUCyp8jn7x4F1fjearbEB12afaO8Cp0";
const CUSTOM_DONATION_SUBSCRIPTION_PRODUCT_ID = 69201;
const FIXED_DONATION_PRODUCT_ID_MAP = {
    30: 67049,
    50: 67057,
    100: 67063,
    500: 67067,
};

/* Build safe URLs */
const API = (path) =>
    `${API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

const SUB_API = (path) =>
    `${SUBSCRIPTION_API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

/* -------- UI helpers -------- */
const money = n => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const debounce = (fn, wait = 400) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};

/* -------- Selected tier state -------- */
let selectedTier = null; // { amount: number, isCustom: boolean }

let lastFormMetadataSignature = "";

const refreshPayments = (() => {
    const debounced = debounce((force = false) => {
        const meta = getFormFieldsMetadata();
        const signature = JSON.stringify(meta) + "|" + (selectedTier ? selectedTier.amount : "");
        if (!force && signature === lastFormMetadataSignature) return;
        lastFormMetadataSignature = signature;
        mountStripePaymentElement();
    }, 1200);

    return (options = {}) => {
        debounced(options.force === true);
    };
})();

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

function calcTotals() {
    const amount = selectedTier ? Number(selectedTier.amount) || 0 : 0;
    const subtotalEl = document.getElementById("subtotal");
    const totalEl = document.getElementById("total_amount");
    if (subtotalEl) subtotalEl.textContent = money(amount);
    if (totalEl) totalEl.textContent = money(amount);
}

function updateSelectedTierUI(activeCard) {
    document.querySelectorAll(".tier_card").forEach((c) => {
        const isActive = c === activeCard;
        c.classList.toggle("is-selected", isActive);
        const cta = c.querySelector(".tier_card__cta");
        if (cta) cta.textContent = isActive ? "SELECTED" : "JOIN NOW";
    });
}

function selectTier(amountRaw, isCustom, cardEl) {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a custom amount greater than $0.");
        return;
    }

    selectedTier = { amount, isCustom: !!isCustom };
    updateSelectedTierUI(cardEl);
    calcTotals();
    wireDynamicFormListeners();
    refreshPayments({ force: true });
}

function wireTierPicker() {
    const cards = document.querySelectorAll(".tier_card");
    cards.forEach((card) => {
        const cta = card.querySelector(".tier_card__cta");
        if (!cta) return;
        cta.addEventListener("click", () => {
            const amountAttr = card.dataset.amount;
            if (amountAttr === "custom") {
                const input = card.querySelector("#tier_custom_amount");
                const v = input ? Number(input.value) : NaN;
                if (!Number.isFinite(v) || v <= 0) {
                    if (input) {
                        input.focus();
                        input.style.borderBottomColor = "#ff9aa2";
                    }
                    return;
                }
                selectTier(v, true, card);
            } else {
                selectTier(amountAttr, false, card);
            }
        });
    });

    const customInput = document.getElementById("tier_custom_amount");
    if (customInput) {
        customInput.addEventListener("input", () => {
            customInput.style.borderBottomColor = "";
            // If the custom card is currently selected, keep totals in sync as user types
            const card = customInput.closest(".tier_card");
            if (card && card.classList.contains("is-selected")) {
                const v = Number(customInput.value);
                if (Number.isFinite(v) && v > 0) {
                    selectedTier = { amount: v, isCustom: true };
                    calcTotals();
                    refreshPayments({ force: true });
                }
            }
        });
        customInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                const card = customInput.closest(".tier_card");
                const cta = card && card.querySelector(".tier_card__cta");
                if (cta) cta.click();
            }
        });
    }
}

/***** Cart helpers *****/
function getCartItems() {
    if (!selectedTier) return [];
    return [{
        id: getSelectedSubscriptionProductId(),
        sku: "",
        name: selectedTier.isCustom ? "Custom Monthly Gift" : `$${selectedTier.amount} Monthly Gift`,
        unit_price: selectedTier.amount,
        quantity: 1,
        is_subscription: true,
    }];
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
    if (!selectedTier) return null;
    if (selectedTier.isCustom) return CUSTOM_DONATION_SUBSCRIPTION_PRODUCT_ID;
    const fixed = FIXED_DONATION_PRODUCT_ID_MAP[selectedTier.amount];
    if (fixed) return fixed;
    return CUSTOM_DONATION_SUBSCRIPTION_PRODUCT_ID;
}

function getSelectedRecurringAmount() {
    if (!selectedTier) return null;
    return selectedTier.amount > 0 ? selectedTier.amount : null;
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

/** Stripe Payment Element */
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
        msg.textContent = "Select a monthly gift amount to enter payment details.";
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
                    subtotal: subtotal.toFixed(2),
                    payment_type: "monthly_subscription",
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
        form_name: "monthly-subscriptions-form",
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
        recurring_interval: "monthly",
        metadata: {
            donation_amount: recurringAmount ? recurringAmount.toFixed(2) : "",
            heard_about_us: formMeta.heard_about_us || "",
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
            await sendSubscriptionIntake(paymentIntent);
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

/***** Boot *****/
(function bootstrap() {
    const titleEl = document.getElementById("form-title");
    if (titleEl) {
        titleEl.textContent = "";
        titleEl.style.display = "none";
    }
    wireTierPicker();
})();

/***** Keep Stripe in sync when totals change *****/
const totalEl = document.getElementById("total_amount");
if (totalEl) {
    const observeTotals = new MutationObserver(() => {
        refreshPayments({ force: true });
    });
    observeTotals.observe(totalEl, { childList: true, subtree: true, characterData: true });
}

/***** Mount payments when UI is ready *****/
window.addEventListener("load", () => {
    mountStripePaymentElement();
    const btn = document.getElementById("stripe-pay-button");
    if (btn) btn.addEventListener("click", handleStripePayNow);
});
