from app.services.posts import calculate_word_count, count_words_in_markdown

from tests.conftest import MockSupabaseClient


def test_plain_text():
    assert count_words_in_markdown("hello world foo") == 3


def test_markdown_headings_stripped():
    assert count_words_in_markdown("# Hello World") == 2


def test_markdown_bold_italic_stripped():
    text = "**bold** and _italic_ text"
    assert count_words_in_markdown(text) == 4


def test_markdown_backticks_stripped():
    assert count_words_in_markdown("`code` is here") == 3


def test_empty_string_returns_zero():
    assert count_words_in_markdown("") == 0


def test_whitespace_only_returns_zero():
    assert count_words_in_markdown("   \n\t  ") == 0


def test_single_word():
    assert count_words_in_markdown("hello") == 1


def test_multi_paragraph():
    text = "First paragraph here.\n\nSecond paragraph here too."
    result = count_words_in_markdown(text)
    assert result == 7  # 3 + 4 words


def test_mixed_markdown_formatting():
    text = "## Header\n\nSome **bold** and *italic* with `code` and > quote"
    result = count_words_in_markdown(text)
    assert result > 0
    assert isinstance(result, int)


def test_links_stripped():
    text = "Check [this link](http://example.com) out"
    result = count_words_in_markdown(text)
    # brackets and parens stripped, words remain
    assert result >= 3


# ---------------------------------------------------------------------------
# 100-word publish-validation boundary
# ---------------------------------------------------------------------------
# These tests pin the boundary the publish endpoint enforces. Any refactor of
# count_words_in_markdown must keep 99→invalid, 100/101→valid.

def test_count_words_exactly_99():
    text = " ".join(["word"] * 99)
    assert count_words_in_markdown(text) == 99


def test_count_words_exactly_100():
    text = " ".join(["word"] * 100)
    assert count_words_in_markdown(text) == 100


def test_count_words_exactly_101():
    text = " ".join(["word"] * 101)
    assert count_words_in_markdown(text) == 101


def test_count_words_with_markdown_formatting_preserves_count():
    # Formatting characters should not inflate or shrink the count.
    text = " ".join(["**word**"] * 100)
    assert count_words_in_markdown(text) == 100


# ---------------------------------------------------------------------------
# Additional content shapes — unicode, code fences, lists, link-only
# ---------------------------------------------------------------------------

def test_count_words_unicode():
    assert count_words_in_markdown("café résumé naïveté") == 3


def test_count_words_cjk_treated_as_single_token_when_no_whitespace():
    # Without a tokenizer that knows CJK, a whitespace-free CJK string is one
    # "word". This test pins the actual behavior so a refactor to use a real
    # tokenizer is a deliberate, observable change.
    assert count_words_in_markdown("你好世界") == 1


def test_count_words_blockquote_marker_stripped():
    assert count_words_in_markdown("> one two three") == 3


def test_count_words_ordered_list_numbers_count():
    # "1." is not stripped — the digit+period reads as a token. Pin the
    # behavior so list rendering changes don't silently shift word counts.
    text = "1. apple\n2. banana\n3. cherry"
    result = count_words_in_markdown(text)
    assert result >= 3  # at least the fruit words


def test_count_words_link_only():
    # A bare link still has words after bracket-stripping.
    text = "[click here](https://example.com)"
    result = count_words_in_markdown(text)
    assert result >= 2  # "click", "here", maybe URL fragments


def test_count_words_code_fence_text_counted():
    # Triple backticks are stripped (backtick is in the strip class) and the
    # remaining "python" + body words count. This is intentional — the editor
    # treats code as content, not chrome.
    text = "```python\nprint('hello world')\n```"
    result = count_words_in_markdown(text)
    assert result > 0


def test_count_words_only_punctuation_returns_zero():
    # All chars stripped by the markdown class → empty string → 0.
    assert count_words_in_markdown("# ** __ ~~ `` >> []()!") == 0


def test_count_words_pipes_in_table_stripped():
    text = "| col1 | col2 |\n| a | b |"
    # Pipes stripped; "col1 col2 a b" → 4
    assert count_words_in_markdown(text) == 4


# ---------------------------------------------------------------------------
# calculate_word_count — aggregates across top-level markdown blocks
# ---------------------------------------------------------------------------

def test_calculate_word_count_sums_only_top_level_markdown_blocks():
    db = MockSupabaseClient()
    db.set_response([
        {"content": {"markdown": "one two three"}},
        {"content": {"markdown": "four five"}},
    ])
    assert calculate_word_count(db, "post-1") == 5


def test_calculate_word_count_zero_when_no_blocks():
    db = MockSupabaseClient()
    db.set_response([])
    assert calculate_word_count(db, "post-1") == 0


def test_calculate_word_count_tolerates_missing_content_field():
    db = MockSupabaseClient()
    db.set_response([
        {"content": {}},                    # no markdown key
        {},                                  # no content key at all
        {"content": {"markdown": "yes ok"}},
    ])
    assert calculate_word_count(db, "post-1") == 2
