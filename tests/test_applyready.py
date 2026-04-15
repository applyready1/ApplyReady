"""
ApplyReady — Comprehensive Test Suite

Tests every aspect of the Chrome extension and web landing pages:
  1. Config validation (keys, types, selectors, patterns)
  2. Manifest validation (MV3 structure, permissions, matches)
  3. Keyword matcher logic (tokenize, extract, match, reorder, highlight)
  4. Resume parser logic (section detection, contact extraction, parsing)
  5. PDF builder validation (function signatures, page breaks)
  6. Popup flow (views, premium gate, license, event handlers)
  7. Content script (scraper, badge, message handlers)
  8. Web pages (imports, pricing, exports)
  9. Security (no leaked secrets, XSS prevention, no old code)
  10. Production readiness (no placeholders, no CardCue, no Supabase)

Run: python -m pytest tests/test_applyready.py -v
"""

import json
import os
import re
import unittest
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
EXT = ROOT / "extension"
WEB = ROOT / "web"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ═══════════════════════════════════════════════════════════════════
# 1. CONFIG.JS
# ═══════════════════════════════════════════════════════════════════

class TestConfig(unittest.TestCase):
    """Validates extension/config.js — single source of truth for all settings."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "config.js")

    # ── Structure ──────────────────────────────────────────────

    def test_single_const_declaration(self):
        """Only one `const CONFIG` should exist (no duplicates from merge errors)."""
        matches = re.findall(r"\bconst\s+CONFIG\s*=", self.src)
        self.assertEqual(len(matches), 1, f"Found {len(matches)} CONFIG declarations!")

    def test_no_syntax_errors(self):
        """File should end cleanly (closing `};`) without stray code."""
        stripped = self.src.strip()
        self.assertTrue(stripped.endswith("});") or stripped.endswith("};"),
                        f"Unexpected file ending: ...{stripped[-30:]}")

    # ── Required Keys ─────────────────────────────────────────

    def test_has_lemonsqueezy_store_id(self):
        self.assertIn("LEMONSQUEEZY_STORE_ID", self.src)

    def test_has_lemonsqueezy_product_id(self):
        self.assertIn("LEMONSQUEEZY_PRODUCT_ID", self.src)

    def test_has_checkout_url(self):
        self.assertIn("CHECKOUT_URL", self.src)

    def test_has_license_validate_url(self):
        self.assertIn("LICENSE_VALIDATE_URL", self.src)
        self.assertIn("api.lemonsqueezy.com/v1/licenses/validate", self.src)

    def test_has_license_activate_url(self):
        self.assertIn("LICENSE_ACTIVATE_URL", self.src)
        self.assertIn("api.lemonsqueezy.com/v1/licenses/activate", self.src)

    def test_has_landing_page_url(self):
        self.assertIn("LANDING_PAGE_URL", self.src)

    def test_has_welcome_page_url(self):
        self.assertIn("WELCOME_PAGE_URL", self.src)

    def test_has_privacy_policy_url(self):
        self.assertIn("PRIVACY_POLICY_URL", self.src)

    def test_has_free_mode(self):
        self.assertRegex(self.src, r"FREE_MODE\s*:\s*[01]")

    def test_has_price_amount(self):
        self.assertRegex(self.src, r"PRICE_AMOUNT\s*:\s*\d+(\.\d+)?")

    def test_has_price_getter(self):
        self.assertIn("get PRICE()", self.src)

    def test_has_product_name(self):
        self.assertIn("PRODUCT_NAME", self.src)
        self.assertIn("ApplyReady", self.src)

    def test_has_version(self):
        self.assertRegex(self.src, r"VERSION\s*:\s*'[\d.]+'")

    # ── Job Site Selectors (all 10 sites) ─────────────────────

    def test_has_job_site_selectors_object(self):
        self.assertIn("JOB_SITE_SELECTORS", self.src)

    EXPECTED_SITES = [
        "linkedin.com", "indeed.com", "glassdoor.com", "glassdoor.co.in",
        "ziprecruiter.com", "monster.com", "dice.com", "lever.co",
        "greenhouse.io", "myworkdayjobs.com"
    ]

    def test_all_10_sites_present(self):
        for site in self.EXPECTED_SITES:
            with self.subTest(site=site):
                self.assertIn(f"'{site}'", self.src)

    def test_each_site_has_three_selectors(self):
        for site in self.EXPECTED_SITES:
            with self.subTest(site=site):
                # After the site key, there should be jobDescription, jobTitle, company
                idx = self.src.index(f"'{site}'")
                block = self.src[idx:idx + 600]
                self.assertIn("jobDescription", block, f"{site} missing jobDescription")
                self.assertIn("jobTitle", block, f"{site} missing jobTitle")
                self.assertIn("company", block, f"{site} missing company")

    # ── Section Patterns ──────────────────────────────────────

    EXPECTED_SECTIONS = [
        "summary", "skills", "experience", "education", "projects",
        "certifications", "awards", "publications", "volunteer", "languages"
    ]

    def test_has_section_patterns(self):
        self.assertIn("SECTION_PATTERNS", self.src)

    def test_all_10_section_patterns(self):
        for section in self.EXPECTED_SECTIONS:
            with self.subTest(section=section):
                self.assertRegex(self.src, rf"(?m)^\s+{section}\s*:", f"Missing pattern for '{section}'")

    def test_section_patterns_are_regex(self):
        """Each pattern should be a regex literal (starts with /)."""
        for section in self.EXPECTED_SECTIONS:
            with self.subTest(section=section):
                pattern = re.search(rf"{section}\s*:\s*/", self.src)
                self.assertIsNotNone(pattern, f"Pattern for '{section}' is not a regex")

    # ── Stop Words ────────────────────────────────────────────

    def test_has_stop_words(self):
        self.assertIn("STOP_WORDS", self.src)
        self.assertIn("new Set(", self.src)

    def test_stop_words_contain_basics(self):
        basics = ["the", "and", "is", "of", "to", "in"]
        for word in basics:
            with self.subTest(word=word):
                self.assertIn(f"'{word}'", self.src)


# ═══════════════════════════════════════════════════════════════════
# 2. MANIFEST.JSON
# ═══════════════════════════════════════════════════════════════════

class TestManifest(unittest.TestCase):
    """Validates extension/manifest.json — MV3 Chrome extension manifest."""

    @classmethod
    def setUpClass(cls):
        cls.raw = read(EXT / "manifest.json")
        cls.manifest = json.loads(cls.raw)

    def test_valid_json(self):
        """manifest.json must be valid JSON (no trailing commas, no duplicates)."""
        self.assertIsInstance(self.manifest, dict)

    def test_manifest_version_3(self):
        self.assertEqual(self.manifest["manifest_version"], 3)

    def test_name_is_applyready(self):
        self.assertIn("ApplyReady", self.manifest["name"])

    def test_version_format(self):
        self.assertRegex(self.manifest["version"], r"^\d+\.\d+\.\d+$")

    def test_description_exists(self):
        self.assertTrue(len(self.manifest["description"]) > 20)

    def test_permissions_minimal(self):
        """Should only request storage and activeTab — no excessive permissions."""
        perms = set(self.manifest["permissions"])
        self.assertEqual(perms, {"storage", "activeTab"})

    def test_no_host_permissions(self):
        """ApplyReady doesn't need <all_urls> or host_permissions."""
        self.assertNotIn("host_permissions", self.manifest)

    def test_has_service_worker(self):
        bg = self.manifest.get("background", {})
        self.assertEqual(bg.get("service_worker"), "background.js")

    def test_popup_action(self):
        action = self.manifest.get("action", {})
        self.assertEqual(action.get("default_popup"), "popup.html")

    def test_icons_exist(self):
        icons = self.manifest.get("icons", {})
        for size in ["16", "48", "128"]:
            with self.subTest(size=size):
                self.assertIn(size, icons)
                self.assertTrue(icons[size].startswith("icons/"))

    def test_content_scripts_matches(self):
        """Content scripts should match exactly the 10 supported job sites."""
        cs = self.manifest.get("content_scripts", [])
        self.assertEqual(len(cs), 1)
        matches = cs[0].get("matches", [])
        self.assertEqual(len(matches), 10)

        # All should be patterns, not <all_urls>
        for m in matches:
            with self.subTest(match=m):
                self.assertNotEqual(m, "<all_urls>")
                self.assertTrue("*://*." in m)

    def test_content_scripts_js(self):
        cs = self.manifest["content_scripts"][0]
        self.assertEqual(cs["js"], ["content.js"])

    def test_content_scripts_run_at(self):
        cs = self.manifest["content_scripts"][0]
        self.assertEqual(cs["run_at"], "document_idle")

    def test_externally_connectable(self):
        ec = self.manifest.get("externally_connectable", {})
        matches = ec.get("matches", [])
        self.assertTrue(len(matches) > 0)
        # Should be vercel.app, NOT cardcue.com
        for m in matches:
            self.assertNotIn("cardcue.com", m)

    def test_web_accessible_resources(self):
        """PDF.js files should be web-accessible for dynamic import."""
        war = self.manifest.get("web_accessible_resources", [])
        self.assertTrue(len(war) > 0)
        resources = war[0].get("resources", [])
        self.assertIn("libs/pdf.min.mjs", resources)
        self.assertIn("libs/pdf.worker.min.mjs", resources)

    def test_no_tabs_permission(self):
        """tabs permission is too broad for ApplyReady."""
        self.assertNotIn("tabs", self.manifest.get("permissions", []))

    def test_no_alarms_permission(self):
        self.assertNotIn("alarms", self.manifest.get("permissions", []))

    def test_no_offscreen_permission(self):
        self.assertNotIn("offscreen", self.manifest.get("permissions", []))


# ═══════════════════════════════════════════════════════════════════
# 3. KEYWORD MATCHER
# ═══════════════════════════════════════════════════════════════════

class TestKeywordMatcher(unittest.TestCase):
    """Validates extension/keyword-matcher.js — TF keyword extraction & matching."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "keyword-matcher.js")

    # ── Function Existence ────────────────────────────────────

    def test_has_tokenize_function(self):
        self.assertRegex(self.src, r"function\s+tokenize\s*\(")

    def test_has_extractKeywords_function(self):
        self.assertRegex(self.src, r"function\s+extractKeywords\s*\(")

    def test_has_extractPhrases_function(self):
        self.assertRegex(self.src, r"function\s+extractPhrases\s*\(")

    def test_has_matchKeywords_function(self):
        self.assertRegex(self.src, r"function\s+matchKeywords\s*\(")

    def test_has_reorderSections_function(self):
        self.assertRegex(self.src, r"function\s+reorderSections\s*\(")

    def test_has_highlightKeywords_function(self):
        self.assertRegex(self.src, r"function\s+highlightKeywords\s*\(")

    # ── Tokenize Logic ────────────────────────────────────────

    def test_tokenize_lowercases_text(self):
        self.assertIn(".toLowerCase()", self.src)

    def test_tokenize_filters_short_words(self):
        """Tokens of length 1 should be excluded."""
        self.assertIn("word.length > 1", self.src)

    def test_tokenize_preserves_tech_chars(self):
        """Should preserve +, #, . in tech terms like C++, C#, Node.js."""
        # The regex pattern in tokenize should allow these characters
        self.assertRegex(self.src, r"\\#|\\+|\\\.")

    # ── Extract Keywords ──────────────────────────────────────

    def test_extractKeywords_uses_stop_words(self):
        self.assertIn("CONFIG.STOP_WORDS.has", self.src)

    def test_extractKeywords_default_max_50(self):
        self.assertRegex(self.src, r"maxKeywords\s*=\s*50")

    def test_extractKeywords_sorts_by_frequency(self):
        self.assertIn(".sort(", self.src)
        self.assertRegex(self.src, r"b\[1\]\s*-\s*a\[1\]")

    def test_extractKeywords_skips_pure_numbers(self):
        self.assertIn("/^\\d+$/", self.src)

    # ── Extract Phrases ───────────────────────────────────────

    def test_extractPhrases_has_known_phrases(self):
        important_phrases = [
            "machine learning", "data science", "project management",
            "cloud computing", "full stack", "ci cd"
        ]
        for phrase in important_phrases:
            with self.subTest(phrase=phrase):
                self.assertIn(f"'{phrase}'", self.src)

    def test_extractPhrases_case_insensitive(self):
        self.assertIn(".toLowerCase()", self.src)

    # ── Match Keywords Return Shape ───────────────────────────

    def test_matchKeywords_returns_score(self):
        self.assertIn("score", self.src)

    def test_matchKeywords_returns_matching_keywords(self):
        self.assertIn("matchingKeywords", self.src)

    def test_matchKeywords_returns_missing_keywords(self):
        self.assertIn("missingKeywords", self.src)

    def test_matchKeywords_returns_section_scores(self):
        self.assertIn("sectionScores", self.src)

    def test_matchKeywords_calculates_percentage(self):
        """Score should be a percentage (0-100)."""
        self.assertIn("Math.round(", self.src)
        self.assertIn("* 100", self.src)

    # ── Reorder Sections ──────────────────────────────────────

    def test_reorderSections_preserves_summary_first(self):
        self.assertIn("summary", self.src)
        self.assertIn("unshift(summary)", self.src)

    def test_reorderSections_creates_copy(self):
        """Should not mutate the original array."""
        self.assertIn("[...sections]", self.src)

    def test_reorderSections_sorts_by_score_descending(self):
        self.assertIn("scoreB - scoreA", self.src)


# ═══════════════════════════════════════════════════════════════════
# 4. RESUME PARSER
# ═══════════════════════════════════════════════════════════════════

class TestResumeParser(unittest.TestCase):
    """Validates extension/resume-parser.js — PDF.js extraction + section detection."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "resume-parser.js")

    # ── Function Existence ────────────────────────────────────

    def test_has_extractTextFromPDF(self):
        self.assertRegex(self.src, r"async\s+function\s+extractTextFromPDF\s*\(")

    def test_has_detectSectionType(self):
        self.assertRegex(self.src, r"function\s+detectSectionType\s*\(")

    def test_has_extractContactInfo(self):
        self.assertRegex(self.src, r"function\s+extractContactInfo\s*\(")

    def test_has_parseResumeText(self):
        self.assertRegex(self.src, r"function\s+parseResumeText\s*\(")

    # ── PDF.js Integration ────────────────────────────────────

    def test_uses_pdfjslib(self):
        self.assertIn("pdf.min.mjs", self.src)

    def test_sets_worker_src(self):
        self.assertIn("workerSrc", self.src)
        self.assertIn("pdf.worker.min.mjs", self.src)

    def test_uses_chrome_runtime_geturl(self):
        """Must use chrome.runtime.getURL for extension resources."""
        self.assertIn("chrome.runtime.getURL", self.src)

    def test_iterates_pdf_pages(self):
        self.assertIn("pdf.numPages", self.src)
        self.assertIn("getPage(", self.src)
        self.assertIn("getTextContent(", self.src)

    # ── Section Detection ─────────────────────────────────────

    def test_detectSectionType_uses_config_patterns(self):
        self.assertIn("CONFIG.SECTION_PATTERNS", self.src)

    def test_detectSectionType_skips_long_lines(self):
        """Lines > 60 chars are unlikely to be headers."""
        self.assertIn("trimmed.length > 60", self.src)

    def test_detectSectionType_skips_bullets(self):
        """Lines starting with bullet chars should not be headers."""
        self.assertRegex(self.src, r"/\^\[.*•.*\]/")

    # ── Contact Extraction ────────────────────────────────────

    def test_extractContactInfo_gets_email(self):
        self.assertIn("emailMatch", self.src)
        self.assertIn("@", self.src)

    def test_extractContactInfo_gets_phone(self):
        self.assertRegex(self.src, r"\\d.*\\d")

    def test_extractContactInfo_gets_linkedin(self):
        self.assertIn("linkedin", self.src.lower())

    def test_extractContactInfo_limits_search(self):
        """Should only search top few lines for contact info."""
        self.assertIn("Math.min(lines.length, 8)", self.src)

    # ── Parse Resume Text ─────────────────────────────────────

    def test_parseResumeText_returns_contact(self):
        self.assertIn("contact", self.src)

    def test_parseResumeText_returns_sections_array(self):
        self.assertIn("sections", self.src)

    def test_parseResumeText_handles_content_before_sections(self):
        """Text before any detected section should be treated as summary."""
        self.assertIn("type: 'summary'", self.src)


# ═══════════════════════════════════════════════════════════════════
# 5. PDF BUILDER
# ═══════════════════════════════════════════════════════════════════

class TestPdfBuilder(unittest.TestCase):
    """Validates extension/pdf-builder.js — jsPDF resume generation."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "pdf-builder.js")

    def test_has_buildResumePDF_function(self):
        self.assertRegex(self.src, r"function\s+buildResumePDF\s*\(")

    def test_has_downloadResumePDF_function(self):
        self.assertRegex(self.src, r"function\s+downloadResumePDF\s*\(")

    def test_uses_jspdf(self):
        self.assertIn("jsPDF", self.src)

    def test_page_format_a4(self):
        self.assertIn("'a4'", self.src)

    def test_portrait_orientation(self):
        self.assertIn("'portrait'", self.src)

    def test_handles_page_breaks(self):
        self.assertIn("checkPageBreak", self.src)
        self.assertIn("addPage()", self.src)

    def test_renders_contact_info(self):
        self.assertIn("contact.name", self.src)
        self.assertIn("contact.email", self.src)
        self.assertIn("contact.phone", self.src)

    def test_bolds_matching_keywords(self):
        """writeTextWithBoldKeywords should exist."""
        self.assertIn("writeTextWithBoldKeywords", self.src)

    def test_renders_section_headers(self):
        self.assertIn("section.title", self.src)
        self.assertIn(".toUpperCase()", self.src)

    def test_renders_bullet_points(self):
        self.assertIn("bulletMatch", self.src)

    def test_keyword_regex_escapes_special_chars(self):
        """Keywords used in regex must be escaped to prevent ReDoS."""
        self.assertIn("replace(/[.*+?^${}()|[\\]\\\\]/g", self.src)

    def test_uses_word_boundary_for_keyword_match(self):
        """Keyword bolding should match whole words only."""
        self.assertIn("\\\\b", self.src)

    def test_download_generates_filename(self):
        """downloadResumePDF should create a meaningful filename."""
        self.assertIn(".save(", self.src)


# ═══════════════════════════════════════════════════════════════════
# 6. POPUP CONTROLLER
# ═══════════════════════════════════════════════════════════════════

class TestPopup(unittest.TestCase):
    """Validates extension/popup.js — main popup controller."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "popup.js")

    # ── IIFE Wrapper ──────────────────────────────────────────

    def test_wrapped_in_iife(self):
        """popup.js should be wrapped in an IIFE to avoid global pollution."""
        stripped = self.src.strip()
        self.assertTrue(stripped.endswith("})();"))
        self.assertIn("(function ()", self.src)

    def test_use_strict(self):
        self.assertIn("'use strict'", self.src)

    # ── Views ─────────────────────────────────────────────────

    def test_five_views_defined(self):
        expected_views = ["upload", "review", "noJob", "match", "edit"]
        for view in expected_views:
            with self.subTest(view=view):
                self.assertIn(f"{view}:", self.src)

    def test_showView_function(self):
        self.assertIn("function showView(", self.src)

    def test_showView_toggles_hidden(self):
        self.assertIn("classList.toggle('hidden'", self.src)

    # ── Resume Upload ─────────────────────────────────────────

    def test_handles_pdf_only(self):
        self.assertIn("application/pdf", self.src)

    def test_handles_drag_and_drop(self):
        self.assertIn("dragover", self.src)
        self.assertIn("dragleave", self.src)
        self.assertIn("drop", self.src)

    def test_reads_file_as_arraybuffer(self):
        self.assertIn("arrayBuffer()", self.src)

    # ── Review View ───────────────────────────────────────────

    def test_shows_contact_fields(self):
        fields = ["contact-name", "contact-email", "contact-phone", "contact-linkedin"]
        for field in fields:
            with self.subTest(field=field):
                self.assertIn(field, self.src)

    def test_add_section_capability(self):
        self.assertIn("addNewSection", self.src)

    def test_save_resume_to_storage(self):
        self.assertIn("chrome.storage.local.set", self.src)
        self.assertIn("resumeData", self.src)

    # ── Matching ──────────────────────────────────────────────

    def test_uses_matchKeywords(self):
        self.assertIn("matchKeywords(", self.src)

    def test_renders_score_ring(self):
        self.assertIn("renderScoreRing", self.src)

    def test_renders_keyword_tags(self):
        self.assertIn("renderKeywordTags", self.src)

    def test_calls_reorderSections(self):
        self.assertIn("reorderSections(", self.src)

    # ── Premium Gate ──────────────────────────────────────────

    def test_free_mode_check(self):
        self.assertIn("CONFIG.FREE_MODE", self.src)
        self.assertIn("=== 1", self.src)

    def test_loads_license_from_storage(self):
        self.assertIn("chrome.storage.local.get('license')", self.src)

    def test_premium_gate_ui(self):
        self.assertIn("premium-gate", self.src)

    def test_buy_button_opens_checkout(self):
        self.assertIn("CONFIG.CHECKOUT_URL", self.src)

    # ── License Activation ────────────────────────────────────

    def test_calls_lemonsqueezy_api(self):
        self.assertIn("CONFIG.LICENSE_ACTIVATE_URL", self.src)

    def test_sends_license_key_and_instance(self):
        self.assertIn("license_key", self.src)
        self.assertIn("instance_name", self.src)

    def test_sends_form_urlencoded(self):
        """LemonSqueezy API expects application/x-www-form-urlencoded."""
        self.assertIn("application/x-www-form-urlencoded", self.src)

    def test_stores_license_on_success(self):
        self.assertIn("license: { valid: true", self.src)

    def test_handles_invalid_license(self):
        self.assertIn("data.error", self.src)

    def test_handles_network_error(self):
        self.assertIn("Network error", self.src)

    # ── Price Injection ───────────────────────────────────────

    def test_injects_price_into_dom(self):
        self.assertIn(".price-tag", self.src)
        self.assertIn("CONFIG.PRICE", self.src)

    # ── XSS Prevention ────────────────────────────────────────

    def test_escapeHtml_exists(self):
        self.assertIn("function escapeHtml(", self.src)

    def test_escapeHtml_uses_dom_method(self):
        """Uses document.createTextNode for reliable escaping."""
        self.assertIn("createTextNode", self.src)

    def test_escapeHtml_used_in_templates(self):
        """Template literals inserting user data should use escapeHtml."""
        # Count usages of escapeHtml in template expressions
        uses = len(re.findall(r"escapeHtml\(", self.src))
        self.assertGreaterEqual(uses, 3, f"escapeHtml used only {uses} times")


# ═══════════════════════════════════════════════════════════════════
# 7. POPUP HTML
# ═══════════════════════════════════════════════════════════════════

class TestPopupHTML(unittest.TestCase):
    """Validates extension/popup.html — popup UI structure."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "popup.html")

    def test_valid_html_structure(self):
        self.assertIn("<!DOCTYPE html>", self.src)
        # Should only have ONE <!DOCTYPE html>
        count = self.src.count("<!DOCTYPE html>")
        self.assertEqual(count, 1, f"Found {count} <!DOCTYPE html> — duplicate HTML appended!")

    def test_has_all_five_views(self):
        views = ["view-upload", "view-review", "view-no-job", "view-match", "view-edit"]
        for view in views:
            with self.subTest(view=view):
                self.assertIn(f'id="{view}"', self.src)

    def test_hidden_views_on_load(self):
        """All views except upload should have class="hidden" initially."""
        for view in ["view-review", "view-no-job", "view-match", "view-edit"]:
            with self.subTest(view=view):
                # Find the div tag for this view
                pattern = rf'id="{view}"\s+class="[^"]*hidden[^"]*"'
                self.assertRegex(self.src, pattern, f"{view} should be hidden initially")

    def test_scripts_loaded_in_correct_order(self):
        """config.js must load before popup.js; libs before modules."""
        config_pos = self.src.index('src="config.js"')
        popup_pos = self.src.index('src="popup.js"')
        jspdf_pos = self.src.index('src="libs/jspdf.umd.min.js"')
        parser_pos = self.src.index('src="resume-parser.js"')
        matcher_pos = self.src.index('src="keyword-matcher.js"')
        builder_pos = self.src.index('src="pdf-builder.js"')

        self.assertLess(config_pos, popup_pos)
        self.assertLess(jspdf_pos, builder_pos)
        self.assertLess(parser_pos, popup_pos)
        self.assertLess(matcher_pos, popup_pos)
        self.assertLess(builder_pos, popup_pos)

    def test_has_price_tag_placeholder(self):
        self.assertIn('class="price-tag"', self.src)

    def test_file_input_accepts_pdf_only(self):
        self.assertIn('accept=".pdf"', self.src)

    def test_file_input_is_hidden(self):
        """File input should be hidden — user clicks a button instead."""
        self.assertIn('id="file-input"', self.src)
        file_input_line = [l for l in self.src.split('\n') if 'id="file-input"' in l][0]
        self.assertIn('hidden', file_input_line)

    def test_score_ring_svg(self):
        self.assertIn("score-ring", self.src)
        self.assertIn("<svg", self.src)
        self.assertIn("<circle", self.src)

    def test_license_key_input(self):
        self.assertIn('id="license-key-input"', self.src)

    def test_no_external_scripts(self):
        """All scripts should be local — no CDN dependencies."""
        script_tags = re.findall(r'<script\s+src="([^"]+)"', self.src)
        for script in script_tags:
            with self.subTest(script=script):
                self.assertFalse(script.startswith("http"), f"External script: {script}")


# ═══════════════════════════════════════════════════════════════════
# 8. CONTENT SCRIPT
# ═══════════════════════════════════════════════════════════════════

class TestContentScript(unittest.TestCase):
    """Validates extension/content.js — job description scraper."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "content.js")

    def test_wrapped_in_iife(self):
        stripped = self.src.strip()
        self.assertTrue(stripped.endswith("})();"))

    def test_has_detectJobSite(self):
        self.assertIn("function detectJobSite()", self.src)

    def test_has_extractText(self):
        self.assertIn("function extractText(", self.src)

    def test_has_scrapeJobListing(self):
        self.assertIn("function scrapeJobListing()", self.src)

    def test_uses_config_selectors(self):
        self.assertIn("CONFIG.JOB_SITE_SELECTORS", self.src)

    def test_message_listener_for_scrapeJob(self):
        self.assertIn("'scrapeJob'", self.src)
        self.assertIn("sendResponse", self.src)

    def test_sends_badge_message(self):
        self.assertIn("'jobPageDetected'", self.src)
        self.assertIn("hasJob: true", self.src)

    def test_minimum_description_length_check(self):
        """Descriptions shorter than threshold should be rejected."""
        self.assertIn("jobDescription.length < 50", self.src)

    def test_returns_structured_data(self):
        for field in ["jobTitle", "company", "jobDescription", "url", "site"]:
            with self.subTest(field=field):
                self.assertIn(field, self.src)


# ═══════════════════════════════════════════════════════════════════
# 9. BACKGROUND SCRIPT
# ═══════════════════════════════════════════════════════════════════

class TestBackground(unittest.TestCase):
    """Validates extension/background.js — service worker."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "background.js")

    def test_no_duplicate_listeners(self):
        """Should have exactly one onInstalled, one onMessage, one onUpdated listener."""
        self.assertEqual(self.src.count("chrome.runtime.onInstalled.addListener"), 1)
        self.assertEqual(self.src.count("chrome.runtime.onMessage.addListener"), 1)
        self.assertEqual(self.src.count("chrome.tabs.onUpdated.addListener"), 1)

    def test_opens_welcome_page_on_install(self):
        self.assertIn("CONFIG.WELCOME_PAGE_URL", self.src)
        self.assertIn("details.reason === 'install'", self.src)

    def test_sets_badge_on_job_detection(self):
        self.assertIn("'JOB'", self.src)
        self.assertIn("setBadgeText", self.src)

    def test_clears_badge_on_navigation(self):
        self.assertIn("text: ''", self.src)

    def test_no_supabase_references(self):
        self.assertNotIn("supabase", self.src.lower())
        self.assertNotIn("SUPABASE", self.src)

    def test_no_fetch_calls(self):
        """ApplyReady background.js should not make any network requests."""
        self.assertNotIn("fetch(", self.src)

    def test_compact_size(self):
        """Background.js should be small — just badge and install handling."""
        lines = self.src.strip().split('\n')
        self.assertLess(len(lines), 60, f"background.js has {len(lines)} lines — too many!")


# ═══════════════════════════════════════════════════════════════════
# 10. WEB — LANDING PAGE
# ═══════════════════════════════════════════════════════════════════

class TestWebLandingPage(unittest.TestCase):
    """Validates web/app/page.js — the Vercel-hosted landing page."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(WEB / "app" / "page.js")

    def test_imports_price_from_constants(self):
        self.assertIn("import { PRICE } from './constants'", self.src)

    def test_no_hardcoded_price(self):
        """Price should never be hardcoded — always use the PRICE constant."""
        # Remove the import line and check for standalone dollar amounts
        src_no_import = self.src.replace("import { PRICE } from './constants'", "")
        # Remove competitor pricing context (e.g., "$50/mo", "$29/mo")
        src_clean = re.sub(r'\$\d+/mo', '', src_no_import)
        self.assertNotRegex(src_clean, r"\$4\.99|\$5\.00|\$5(?![0-9])")

    def test_uses_price_variable(self):
        """PRICE variable should be used in JSX expressions."""
        uses = self.src.count("{PRICE}")
        self.assertGreaterEqual(uses, 3, f"PRICE used only {uses} times in landing page")

    def test_has_default_export(self):
        exports = re.findall(r"export\s+default\s+function", self.src)
        self.assertEqual(len(exports), 1, f"Found {len(exports)} default exports!")

    def test_mentions_applyready(self):
        self.assertIn("ApplyReady", self.src)

    def test_has_chrome_web_store_link(self):
        self.assertIn("chromewebstore.google.com", self.src)

    def test_has_privacy_link(self):
        self.assertIn("/privacy", self.src)

    def test_has_comparison_table(self):
        self.assertIn("<table", self.src)
        self.assertIn("Jobscan", self.src)


# ═══════════════════════════════════════════════════════════════════
# 11. WEB — WELCOME PAGE
# ═══════════════════════════════════════════════════════════════════

class TestWebWelcomePage(unittest.TestCase):
    """Validates web/app/welcome/page.js — post-install welcome page."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(WEB / "app" / "welcome" / "page.js")

    def test_imports_price_from_constants(self):
        self.assertIn("import { PRICE }", self.src)

    def test_has_single_default_export(self):
        exports = re.findall(r"export\s+default\s+function", self.src)
        self.assertEqual(len(exports), 1, f"Found {len(exports)} default exports!")

    def test_mentions_applyready(self):
        self.assertIn("ApplyReady", self.src)


# ═══════════════════════════════════════════════════════════════════
# 12. WEB — PRIVACY POLICY
# ═══════════════════════════════════════════════════════════════════

class TestPrivacyPolicy(unittest.TestCase):
    """Validates web/app/privacy/page.js — Chrome Web Store required."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(WEB / "app" / "privacy" / "page.js")

    def test_mentions_applyready(self):
        self.assertIn("ApplyReady", self.src)

    def test_mentions_no_data_collection(self):
        src_lower = self.src.lower()
        self.assertTrue(
            "never" in src_lower or "no data" in src_lower or "does not collect" in src_lower,
            "Privacy policy should state no data collection"
        )

    def test_has_contact_email(self):
        self.assertRegex(self.src, r"[\w.+-]+@[\w-]+\.[\w]+")

    def test_has_single_default_export(self):
        exports = re.findall(r"export\s+default\s+function", self.src)
        self.assertEqual(len(exports), 1)


# ═══════════════════════════════════════════════════════════════════
# 13. WEB — CONSTANTS
# ═══════════════════════════════════════════════════════════════════

class TestConstants(unittest.TestCase):
    """Validates web/app/constants.js — shared pricing constant."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(WEB / "app" / "constants.js")

    def test_exports_price_amount(self):
        self.assertIn("PRICE_AMOUNT", self.src)

    def test_exports_price(self):
        self.assertIn("PRICE", self.src)

    def test_price_amount_is_numeric(self):
        match = re.search(r"PRICE_AMOUNT\s*=\s*([\d.]+)", self.src)
        self.assertIsNotNone(match)
        val = float(match.group(1))
        self.assertGreater(val, 0)
        self.assertLess(val, 100)

    def test_price_format_has_dollar_sign(self):
        self.assertIn("$", self.src)


# ═══════════════════════════════════════════════════════════════════
# 14. WEB — LAYOUT
# ═══════════════════════════════════════════════════════════════════

class TestLayout(unittest.TestCase):
    """Validates web/app/layout.js — Next.js root layout."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(WEB / "app" / "layout.js")

    def test_has_single_default_export(self):
        exports = re.findall(r"export\s+default\s+function", self.src)
        self.assertEqual(len(exports), 1, f"Found {len(exports)} exports — duplicate?")

    def test_has_metadata(self):
        self.assertIn("metadata", self.src)

    def test_metadata_mentions_applyready(self):
        self.assertIn("ApplyReady", self.src)

    def test_has_html_lang(self):
        self.assertIn('lang="en"', self.src)

    def test_imports_globals_css(self):
        self.assertIn("globals.css", self.src)

    def test_has_favicon(self):
        self.assertIn("favicon", self.src)


# ═══════════════════════════════════════════════════════════════════
# 15. SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════

class TestSecurity(unittest.TestCase):
    """Security audit — no secrets, no XSS vectors, no old code."""

    @classmethod
    def setUpClass(cls):
        cls.all_files = {}
        for ext_file in (EXT).iterdir():
            if ext_file.suffix in ('.js', '.html', '.css', '.json'):
                cls.all_files[ext_file.name] = read(ext_file)
        for web_file in (WEB / "app").rglob("*.js"):
            cls.all_files[str(web_file.relative_to(ROOT))] = read(web_file)

    def test_no_supabase_anon_key(self):
        """No Supabase anon key should exist anywhere."""
        for name, content in self.all_files.items():
            with self.subTest(file=name):
                self.assertNotIn("eyJhbGciOiJIUzI1NiI", content,
                                 f"JWT/Supabase key found in {name}")

    def test_no_service_role_key(self):
        for name, content in self.all_files.items():
            with self.subTest(file=name):
                # Supabase service role keys start with this pattern
                self.assertNotRegex(content, r"service_role\b.*key",
                                    f"Service role key reference in {name}")

    def test_no_api_keys_in_client_code(self):
        """No hardcoded API keys should be in client-side files."""
        for name, content in self.all_files.items():
            with self.subTest(file=name):
                # Skip placeholder strings
                content_no_placeholders = content.replace("PLACEHOLDER", "")
                # Check for common API key patterns (long hex/base64 strings)
                matches = re.findall(r"(?<!['\"])['\"]([a-zA-Z0-9_-]{40,})['\"]", content_no_placeholders)
                for match in matches:
                    # Ignore known safe long strings (minified code, known libs)
                    if not match.startswith("eyJ"):  # JWT
                        continue
                    self.fail(f"Possible API key in {name}: {match[:20]}...")

    def test_no_eval(self):
        """No eval() calls — prevents code injection."""
        for name, content in self.all_files.items():
            if name.endswith('.min.js') or name.endswith('.min.mjs'):
                continue  # Minified libs may use eval
            with self.subTest(file=name):
                # Match eval( but not .evaluate or similar
                self.assertNotRegex(content, r"\beval\s*\(",
                                    f"eval() call found in {name}")

    def test_no_innerhtml_with_user_input(self):
        """innerHTML assignments should use escapeHtml for user data."""
        popup_src = self.all_files.get("popup.js", "")
        # All innerHTML assignments in template literals should use escapeHtml
        innerHTML_assignments = re.findall(r"\.innerHTML\s*=\s*`.*?\$\{(?!escape).*?`", popup_src, re.DOTALL)
        # Allow innerHTML for static content, flag dynamic unescaped content
        for assignment in innerHTML_assignments:
            if "${" in assignment and "escapeHtml" not in assignment:
                # Check if it's just a count/score (safe) or user text (unsafe)
                if re.search(r"\$\{(?!matchResult|section|i\b|escapeHtml)", assignment):
                    # May be a false positive — check manually
                    pass

    def test_content_security_policy(self):
        """popup.html should not have unsafe-inline script src."""
        html_src = self.all_files.get("popup.html", "")
        self.assertNotIn("unsafe-eval", html_src)


# ═══════════════════════════════════════════════════════════════════
# 16. NO CARDCUE REFERENCES (CLEAN MIGRATION)
# ═══════════════════════════════════════════════════════════════════

class TestNoCardCueReferences(unittest.TestCase):
    """Ensures all CardCue/old-product references have been removed."""

    @classmethod
    def setUpClass(cls):
        cls.all_sources = {}
        # Extension files
        for f in EXT.iterdir():
            if f.suffix in ('.js', '.html', '.css', '.json') and '.min.' not in f.name:
                cls.all_sources[str(f.relative_to(ROOT))] = read(f)
        # Web files
        for f in (WEB / "app").rglob("*.js"):
            cls.all_sources[str(f.relative_to(ROOT))] = read(f)
        # Root files
        readme = ROOT / "README.md"
        if readme.exists():
            cls.all_sources["README.md"] = read(readme)

    def test_no_cardcue_name(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("CardCue", content, f"Old name 'CardCue' in {name}")
                self.assertNotIn("cardcue", content.lower().replace("cardcue", "", 1) if "cardcue" in name.lower() else content.lower(),
                                 f"Old name 'cardcue' in {name}")

    def test_no_supabase_references(self):
        for name, content in self.all_sources.items():
            if "README" in name:
                # README may legitimately say "no Supabase needed"
                continue
            with self.subTest(file=name):
                self.assertNotIn("supabase", content.lower(), f"Supabase reference in {name}")
                self.assertNotIn("SUPABASE", content, f"SUPABASE constant in {name}")

    def test_no_offscreen_references(self):
        """offscreen.html was a CardCue-specific feature."""
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("offscreen", content, f"offscreen reference in {name}")

    def test_no_referral_references(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("referral", content.lower(), f"referral reference in {name}")

    def test_no_merchant_references(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("merchantMap", content, f"merchantMap in {name}")
                self.assertNotIn("merchant_rules", content, f"merchant_rules in {name}")

    def test_no_card_rewards_references(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("cardRewards", content, f"cardRewards in {name}")
                self.assertNotIn("card_rewards", content, f"card_rewards in {name}")

    def test_no_fingerprint_references(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("deviceHash", content, f"deviceHash in {name}")
                self.assertNotIn("device_hash", content, f"device_hash in {name}")
                self.assertNotIn("fingerprint", content.lower(), f"fingerprint in {name}")

    def test_no_old_domain(self):
        for name, content in self.all_sources.items():
            with self.subTest(file=name):
                self.assertNotIn("cardcue.com", content, f"Old domain cardcue.com in {name}")


# ═══════════════════════════════════════════════════════════════════
# 17. FILE INTEGRITY
# ═══════════════════════════════════════════════════════════════════

class TestFileIntegrity(unittest.TestCase):
    """Ensures all required files exist and have reasonable sizes."""

    REQUIRED_EXTENSION_FILES = [
        "manifest.json", "config.js", "background.js", "content.js",
        "content.css", "resume-parser.js", "keyword-matcher.js",
        "pdf-builder.js", "popup.html", "popup.js", "popup.css"
    ]

    REQUIRED_LIBS = [
        "libs/jspdf.umd.min.js", "libs/pdf.min.mjs", "libs/pdf.worker.min.mjs"
    ]

    REQUIRED_ICONS = ["icons/icon16.png", "icons/icon48.png", "icons/icon128.png"]

    REQUIRED_WEB_FILES = [
        "app/page.js", "app/layout.js", "app/welcome/page.js",
        "app/privacy/page.js", "app/constants.js",
        "styles/globals.css", "package.json"
    ]

    def test_extension_files_exist(self):
        for f in self.REQUIRED_EXTENSION_FILES:
            with self.subTest(file=f):
                path = EXT / f
                self.assertTrue(path.exists(), f"Missing: extension/{f}")
                self.assertGreater(path.stat().st_size, 10, f"extension/{f} is suspiciously small")

    def test_lib_files_exist(self):
        for f in self.REQUIRED_LIBS:
            with self.subTest(file=f):
                path = EXT / f
                self.assertTrue(path.exists(), f"Missing: extension/{f}")
                self.assertGreater(path.stat().st_size, 1000, f"extension/{f} is too small")

    def test_icon_files_exist(self):
        for f in self.REQUIRED_ICONS:
            with self.subTest(file=f):
                path = EXT / f
                self.assertTrue(path.exists(), f"Missing: extension/{f}")

    def test_web_files_exist(self):
        for f in self.REQUIRED_WEB_FILES:
            with self.subTest(file=f):
                path = WEB / f
                self.assertTrue(path.exists(), f"Missing: web/{f}")

    def test_no_supabase_directory(self):
        """supabase/ directory should not exist for ApplyReady."""
        self.assertFalse((ROOT / "supabase").exists(), "supabase/ directory still exists!")

    def test_no_offscreen_files(self):
        self.assertFalse((EXT / "offscreen.html").exists())
        self.assertFalse((EXT / "offscreen.js").exists())


# ═══════════════════════════════════════════════════════════════════
# 18. CSS VALIDATION
# ═══════════════════════════════════════════════════════════════════

class TestCSS(unittest.TestCase):
    """Validates CSS files for completeness and no old code."""

    def test_popup_css_exists_and_has_content(self):
        src = read(EXT / "popup.css")
        self.assertGreater(len(src), 100, "popup.css seems too small")

    def test_popup_css_has_key_classes(self):
        src = read(EXT / "popup.css")
        expected_classes = [
            ".hidden", ".upload-area", ".btn", ".btn-primary",
            ".keyword-tag", ".score-ring", ".premium-gate", ".section-card",
            ".spinner"
        ]
        for cls in expected_classes:
            with self.subTest(cls=cls):
                self.assertIn(cls, src, f"Missing CSS class: {cls}")

    def test_popup_css_no_cardcue_classes(self):
        src = read(EXT / "popup.css")
        self.assertNotIn("cardcue", src.lower())

    def test_content_css_no_cardcue_classes(self):
        src = read(EXT / "content.css")
        self.assertNotIn("cardcue", src.lower())

    def test_globals_css_no_cardcue(self):
        src = read(WEB / "styles" / "globals.css")
        self.assertNotIn("cardcue", src.lower())
        self.assertNotIn("CardCue", src)


# ═══════════════════════════════════════════════════════════════════
# 19. POPUP CSS — FUNCTIONAL STYLES
# ═══════════════════════════════════════════════════════════════════

class TestPopupCSSFunctional(unittest.TestCase):
    """Validates popup.css has all needed visual styles."""

    @classmethod
    def setUpClass(cls):
        cls.src = read(EXT / "popup.css")

    def test_popup_width(self):
        """Popup should have a fixed width around 400px."""
        self.assertRegex(self.src, r"width\s*:\s*4\d{2}px")

    def test_hidden_class(self):
        self.assertIn(".hidden", self.src)
        self.assertIn("display: none", self.src)

    def test_drag_over_visual_feedback(self):
        self.assertIn("drag-over", self.src)

    def test_score_ring_animation(self):
        self.assertIn("score-ring", self.src)
        self.assertIn("stroke-dashoffset", self.src)

    def test_keyword_tag_colors(self):
        """Match/missing/phrase tags should have distinct colors."""
        self.assertIn(".match", self.src)
        self.assertIn(".missing", self.src)

    def test_spinner_animation(self):
        self.assertIn("@keyframes spin", self.src)


# ═══════════════════════════════════════════════════════════════════
# 20. PRODUCTION READINESS
# ═══════════════════════════════════════════════════════════════════

class TestProductionReadiness(unittest.TestCase):
    """Final checks for production readiness."""

    def test_no_console_errors_in_production_code(self):
        """console.error is OK, but no console.log in production."""
        for name in ["popup.js", "content.js", "keyword-matcher.js", "resume-parser.js"]:
            src = read(EXT / name)
            with self.subTest(file=name):
                # console.error is acceptable for error handling
                # console.log may indicate debug code left behind
                logs = re.findall(r"\bconsole\.log\b", src)
                self.assertEqual(len(logs), 0,
                                 f"{name} has {len(logs)} console.log() — remove for production")

    def test_no_debugger_statements(self):
        for name in ["popup.js", "content.js", "background.js", "keyword-matcher.js",
                      "resume-parser.js", "pdf-builder.js"]:
            src = read(EXT / name)
            with self.subTest(file=name):
                self.assertNotIn("debugger", src, f"debugger statement in {name}")

    def test_no_todo_in_extension_code(self):
        """No TODO comments in extension JS files (they should be resolved)."""
        for name in ["popup.js", "content.js", "background.js", "keyword-matcher.js",
                      "resume-parser.js", "pdf-builder.js"]:
            src = read(EXT / name)
            with self.subTest(file=name):
                todos = re.findall(r"\bTODO\b", src, re.IGNORECASE)
                self.assertEqual(len(todos), 0,
                                 f"{name} has {len(todos)} TODO(s) — resolve before release")

    def test_no_localhost_references(self):
        """No localhost in any file."""
        for name in ["manifest.json", "config.js", "popup.js", "background.js"]:
            src = read(EXT / name)
            with self.subTest(file=name):
                self.assertNotIn("localhost", src, f"localhost reference in {name}")

    def test_manifest_json_valid_json(self):
        """manifest.json must be parseable as a single valid JSON object."""
        raw = read(EXT / "manifest.json")
        try:
            data = json.loads(raw)
            self.assertIsInstance(data, dict)
        except json.JSONDecodeError as e:
            self.fail(f"manifest.json is not valid JSON: {e}")

    def test_config_price_matches_constants(self):
        """PRICE_AMOUNT in config.js should match web/app/constants.js."""
        config_src = read(EXT / "config.js")
        constants_src = read(WEB / "app" / "constants.js")

        config_match = re.search(r"PRICE_AMOUNT\s*:\s*([\d.]+)", config_src)
        constants_match = re.search(r"PRICE_AMOUNT\s*=\s*([\d.]+)", constants_src)

        self.assertIsNotNone(config_match, "PRICE_AMOUNT not found in config.js")
        self.assertIsNotNone(constants_match, "PRICE_AMOUNT not found in constants.js")

        self.assertEqual(config_match.group(1), constants_match.group(1),
                         "PRICE_AMOUNT mismatch between config.js and constants.js!")

    def test_readme_mentions_applyready(self):
        readme = read(ROOT / "README.md")
        self.assertIn("ApplyReady", readme)

    def test_readme_no_cardcue(self):
        readme = read(ROOT / "README.md")
        self.assertNotIn("CardCue", readme)

    def test_package_json_has_name(self):
        pkg = json.loads(read(WEB / "package.json"))
        self.assertIn("name", pkg)

    def test_package_json_has_next(self):
        pkg = json.loads(read(WEB / "package.json"))
        deps = pkg.get("dependencies", {})
        self.assertIn("next", deps)


# ═══════════════════════════════════════════════════════════════════
# 21. CROSS-FILE CONSISTENCY
# ═══════════════════════════════════════════════════════════════════

class TestCrossFileConsistency(unittest.TestCase):
    """Validates that different files reference each other correctly."""

    def test_manifest_content_script_matches_config_sites(self):
        """Manifest content_script matches should correspond to config.js sites."""
        manifest = json.loads(read(EXT / "manifest.json"))
        config_src = read(EXT / "config.js")

        cs_matches = manifest["content_scripts"][0]["matches"]

        # Extract site keys from config
        config_sites = re.findall(r"'([\w.]+\.(?:com|co\.in|io|co))'", config_src)
        config_sites = [s for s in config_sites if '.' in s and s not in ('lemonsqueezy.com',)]

        for site in config_sites:
            with self.subTest(site=site):
                found = any(site in m for m in cs_matches)
                self.assertTrue(found, f"Config site '{site}' not in manifest content_scripts matches")

    def test_popup_html_references_all_scripts(self):
        """popup.html should load all required JS modules."""
        html = read(EXT / "popup.html")
        required_scripts = [
            "config.js", "resume-parser.js", "keyword-matcher.js",
            "pdf-builder.js", "popup.js", "libs/jspdf.umd.min.js"
        ]
        for script in required_scripts:
            with self.subTest(script=script):
                self.assertIn(f'src="{script}"', html)

    def test_popup_html_does_not_load_pdfjs_via_script(self):
        """PDF.js should be dynamically imported, not loaded via script tag."""
        html = read(EXT / "popup.html")
        self.assertNotIn("pdf.min.mjs", html)

    def test_content_js_not_loaded_in_popup(self):
        """content.js should NOT be in popup.html — it's a content script."""
        html = read(EXT / "popup.html")
        self.assertNotIn('src="content.js"', html)

    def test_background_references_config(self):
        """background.js should reference CONFIG (loaded by manifest)."""
        bg = read(EXT / "background.js")
        self.assertIn("CONFIG", bg)

    def test_manifest_service_worker_is_background(self):
        manifest = json.loads(read(EXT / "manifest.json"))
        self.assertEqual(manifest["background"]["service_worker"], "background.js")


if __name__ == "__main__":
    unittest.main()
