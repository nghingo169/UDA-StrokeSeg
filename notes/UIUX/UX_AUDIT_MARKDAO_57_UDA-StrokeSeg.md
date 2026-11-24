# UX/UI Audit - UDA-StrokeSeg vs Markdao 57-error checklist

* **Date:** 09/11/2026  
* **Scope:** Frontend SPA prototype (4 roles: Radiologist, Stroke Physician, HoD, IT Admin)  
* **Method:** Browser + source review against Markdao groups (mapped to clinical SPA; e-commerce/checkout items N/A)  
* **Priority:** Impact × Frequency × Clinical risk  

---

## Summary

| Priority | Count | Action |
| :--- | ---: | :--- |
| **P0** | 3 | Fixed |
| **P1** | 8 | Fixed |
| **P2** | 11 | Fixed |
| **P3** | 6 | Shipable polish mostly done; 2 N/A |
| **PASS / N/A** | - | Many Markdao e-commerce items do not apply |

**Already fixed:**
- Pass 1: sign-off password empty; attest checkbox required; Sign CTA reasons; Notifications feedback
- Pass 2: disabled CTA microcopy (`CtaHint`); in-app unsaved-leave modal; busy/Saving… on mutating CTAs; muted contrast tokens; workspace breadcrumb; review-step sync; richer empty search recovery
- Pass 3: Pause inference wording; Undo toast (10s); Draft “Review required”; TermTip; worklist skeleton; notification panel; Edit mask text CTA; Demo actors collapsed; clinical panel rhythm; mobile sequence tabs; single clinical theme tokens
- Pass 4: labeled clinical-utility scale; account settings denser; demo password hidden by default; IT metric/health denser on laptop

---

## P0 - Fix now

| ID | Status |
| :--- | :--- |
| **P0-1** Sign-requirements for NOTE + quality | Fixed |
| **P0-2** Attest checkbox required | Fixed |
| **P0-3** Empty step-up password | Fixed |

---

## P1 - High impact

| ID | Status |
| :--- | :--- |
| **P1-1** `CtaHint` on disabled CTAs | Fixed |
| **P1-2** In-app unsaved-leave modal | Fixed |
| **P1-3** Busy / Saving… states | Fixed |
| **P1-4** Draft “Review required” | Fixed |
| **P1-5** TermTip jargon help | Fixed |
| **P1-6** Muted contrast tokens | Fixed |
| **P1-7** Empty search recovery | Fixed |
| **P1-8** Sub-page empty recovery | Fixed |

---

## P2 - Friction / consistency

| ID | Status |
| :--- | :--- |
| **P2-1** Workspace breadcrumb | Fixed |
| **P2-2** Edit mask as text CTA | Fixed |
| **P2-3** Demo actors collapsed | Fixed |
| **P2-4** Notification panel | Fixed |
| **P2-5** Review-step sync | Fixed |
| **P2-6** Clinical panel rhythm | Fixed |
| **P2-7** Mobile sequence tabs | Fixed |
| **P2-8** Pause inference wording | Fixed |
| **P2-9** Undo toast 10s | Fixed |
| **P2-10** Single clinical theme tokens | Fixed |
| **P2-11** Worklist refresh skeleton | Fixed |

---

## P3 - Polish

| ID | Issue | Status |
| :--- | :--- | :--- |
| **P3-1** | Grammarly / extension widgets crowd composer | N/A (not app-owned) |
| **P3-2** | Star rating unclear | Fixed - labeled 1–5 utility scale |
| **P3-3** | Account settings density | Fixed - compact panel + prefs |
| **P3-4** | Demo password shown on login | Fixed - hidden behind toggle |
| **P3-5** | IT metric grid dense on laptop | Fixed - 2-col / denser cards ≤1360px |
| **P3-6** | Consultation cursor sync | N/A (backend) |

---

## Mapped PASS

| Markdao | Status |
| :--- | :--- |
| Composer mic overflow | PASS |
| Progressive disclosure | PASS |

---

## N/A for this product (e-commerce Markdao items)

Checkout fees, KYC card expiry MM/YY, CAPTCHA, cart account-gate, fake urgency countdown, SEO LCP image packs - out of scope for clinical ops SPA.

---

## Evidence notes

* Browser: `localhost:8443` roles Radiologist → Physician → HoD → IT.  
* Source: `src/App.tsx`, `src/index.css`.  
* Related: `notes/UIUX/TEST_EXECUTION_LOG_TR-20261109-UDA-CORE.md`.
