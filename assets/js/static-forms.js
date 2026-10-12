
(function () {
  "use strict";

  var MSG = {
    required: "This field is required.",
    email: "The email address entered is invalid, please check the formatting (e.g. email@domain.com).",
    date: "Please enter a valid date.",
    summary: "There was a problem with your submission. Please review the fields below.",
    sendFail: "Sorry, your request could not be sent right now. Please try again in a few minutes or call our office.",
    notConnected: "The online form is not connected yet. Please call our office to schedule your appointment.",
    thanks: "Thanks for contacting us! We will get in touch with you shortly."
  };

  function endpoint() {
    var c = window.SITE_CONFIG || {};
    return (c.formspreeEndpoint || "").trim();
  }

  function clean(value) {

    return String(value || "").replace(/[\r\n]+/g, " ").trim();
  }

  function fieldLabel(field) {
    var t = field.querySelector(".gform-field-label__text");
    return t ? t.textContent.trim() : "";
  }

  function clearErrors(wrapper) {
    wrapper.classList.remove("gform_validation_error");
    var box = wrapper.querySelector(".gform_validation_errors");
    if (box) box.parentNode.removeChild(box);
    Array.prototype.forEach.call(wrapper.querySelectorAll(".gfield_error"), function (f) {
      f.classList.remove("gfield_error");
    });
    Array.prototype.forEach.call(wrapper.querySelectorAll(".gfield_validation_message"), function (m) {
      m.parentNode.removeChild(m);
    });
    Array.prototype.forEach.call(wrapper.querySelectorAll("[aria-invalid='true']"), function (i) {
      i.setAttribute("aria-invalid", "false");
      i.removeAttribute("aria-describedby");
    });
  }

  function showSummary(wrapper, formId, text) {
    var box = document.createElement("div");
    box.className = "gform_validation_errors";
    box.id = "gform_" + formId + "_validation_container";
    box.setAttribute("data-js", "gform-focus-validation-error");
    box.setAttribute("tabindex", "-1");
    var h = document.createElement("h2");
    h.className = "gform_submission_error hide_summary";
    var icon = document.createElement("span");
    icon.className = "gform-icon gform-icon--circle-error";
    h.appendChild(icon);
    h.appendChild(document.createTextNode(text));
    box.appendChild(h);
    var form = wrapper.querySelector("form");
    form.parentNode.insertBefore(box, form);
    return box;
  }

  function markField(field, input, formId, text) {
    field.classList.add("gfield_error");
    var fid = field.id.replace("field_", "");
    var msg = document.createElement("div");
    msg.id = "validation_message_" + fid;
    msg.className = "gfield_description validation_message gfield_validation_message";
    msg.textContent = text;
    var container = field.querySelector(".ginput_container");
    (container || field).insertAdjacentElement(container ? "afterend" : "beforeend", msg);
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", msg.id);
  }

  function scrollToWrapper(el) {
    var mt = (parseInt(getComputedStyle(document.documentElement).marginTop, 10) || 0) +
             (parseInt(getComputedStyle(document.body).marginTop, 10) || 0) + 100;
    var top = el.getBoundingClientRect().top + window.pageYOffset - mt;
    window.scrollTo(0, Math.max(0, top));
  }

  function validDate(v) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (!m) return false;
    var d = new Date(+m[3], +m[1] - 1, +m[2]);
    return d.getFullYear() === +m[3] && d.getMonth() === +m[1] - 1 && d.getDate() === +m[2];
  }

  function validate(form, formId) {
    var bad = [];
    Array.prototype.forEach.call(form.querySelectorAll(".gfield"), function (field) {
      var input = field.querySelector("input:not([type=hidden]), select, textarea");
      if (!input) return;
      var v = (input.value || "").trim();
      var required = input.getAttribute("aria-required") === "true";
      if (required && !v) { bad.push([field, input, MSG.required]); return; }
      if (v && input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        bad.push([field, input, MSG.email]); return;
      }
      if (v && input.classList.contains("datepicker") && !validDate(v)) {
        bad.push([field, input, MSG.date]);
      }
    });
    return bad;
  }

  function collect(form) {
    var data = new FormData();
    Array.prototype.forEach.call(form.querySelectorAll(".gfield"), function (field) {
      var input = field.querySelector("input:not([type=hidden]), select, textarea");
      if (!input || !input.name) return;
      var key = input.type === "email" ? "email" : (fieldLabel(field) || input.name);
      var value = input.tagName === "TEXTAREA" ? String(input.value || "").trim() : clean(input.value);
      data.append(key, value);
    });
    data.append("Sent from page", document.title + " - " + location.href.split("#")[0]);
    data.append("_subject", "New appointment request from the website");
    return data;
  }

  function setBusy(form, formId, busy) {
    var btn = form.querySelector("#gform_submit_button_" + formId);
    if (!btn) return;
    btn.disabled = busy;
    var spin = document.getElementById("gform_ajax_spinner_" + formId);
    if (busy && !spin) {
      spin = document.createElement("span");
      spin.id = "gform_ajax_spinner_" + formId;
      spin.className = "gform-loader";
      spin.setAttribute("data-js-spinner-id", "gform_ajax_spinner_" + formId);
      btn.insertAdjacentElement("afterend", spin);
    } else if (!busy && spin) {
      spin.parentNode.removeChild(spin);
    }
  }

  function showThanks(wrapper, formId) {
    var out = document.createElement("div");
    out.innerHTML =
      "<div id='gf_" + formId + "' class='gform_anchor' tabindex='-1'></div>" +
      "<div id='gform_confirmation_wrapper_" + formId + "' class='gform_confirmation_wrapper '>" +
      "<div id='gform_confirmation_message_" + formId + "' class='gform_confirmation_message_" + formId +
      " gform_confirmation_message'></div></div>";
    out.querySelector(".gform_confirmation_message").textContent = MSG.thanks;
    var parent = wrapper.parentNode;
    while (out.firstChild) parent.insertBefore(out.firstChild, wrapper);
    parent.removeChild(wrapper);
    var anchor = document.getElementById("gf_" + formId);
    if (anchor) scrollToWrapper(anchor);
  }

  function onSubmit(e) {
    var form = e.target;
    if (!form || !form.hasAttribute || !form.hasAttribute("data-static-form")) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    var formId = form.getAttribute("data-static-form");
    var wrapper = document.getElementById("gform_wrapper_" + formId) || form.parentNode;
    if (form.getAttribute("data-sending") === "1") return;

    clearErrors(wrapper);
    var bad = validate(form, formId);
    if (bad.length) {
      wrapper.classList.add("gform_validation_error");
      var box = showSummary(wrapper, formId, MSG.summary);
      bad.forEach(function (b) { markField(b[0], b[1], formId, b[2]); });
      scrollToWrapper(wrapper);
      box.focus({ preventScroll: true });
      return;
    }

    var url = endpoint();
    if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(url)) {
      wrapper.classList.add("gform_validation_error");
      showSummary(wrapper, formId, MSG.notConnected).focus({ preventScroll: true });
      scrollToWrapper(wrapper);
      return;
    }

    form.setAttribute("data-sending", "1");
    setBusy(form, formId, true);
    fetch(url, { method: "POST", body: collect(form), headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("status " + res.status);
        showThanks(wrapper, formId);
      })
      .catch(function () {
        form.removeAttribute("data-sending");
        setBusy(form, formId, false);
        wrapper.classList.add("gform_validation_error");
        showSummary(wrapper, formId, MSG.sendFail).focus({ preventScroll: true });
        scrollToWrapper(wrapper);
      });
  }

  document.addEventListener("submit", onSubmit, true);

})();
