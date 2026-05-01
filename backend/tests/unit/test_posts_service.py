from app.services.posts import count_words_in_markdown


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
