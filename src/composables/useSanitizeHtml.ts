import sanitizeHtml from 'sanitize-html';

/**
 * Composable for sanitizing HTML content
 * Provides safe HTML sanitization for product descriptions and user-generated content
 */
export function useSanitizeHtml() {
  /**
   * Sanitize HTML for product descriptions
   * Allows safe formatting tags only
   */
  const sanitizeDescription = (html: string): string => {
    if (!html || typeof html !== 'string') {
      return '';
    }

    return sanitizeHtml(html, {
      allowedTags: ['b', 'i', 'em', 'strong', 'u', 's', 'ul', 'ol', 'li', 'p', 'br', 'h1', 'h2', 'h3', 'h4'],
      allowedAttributes: {
        'p': ['style'], // Allow paragraph styles for indentation
        'li': ['style']
      },
      allowedStyles: {
        '*': {
          'padding-left': [/^\d+(?:px|em|rem)$/], // Allow indentation
          'margin-left': [/^\d+(?:px|em|rem)$/]
        }
      },
      disallowedTagsMode: 'discard',
      allowedSchemes: [], // No links/images
      allowedSchemesByTag: {},
      allowProtocolRelative: false,
      // Enforce closing tags
      enforceHtmlBoundary: true,
      // Remove empty tags
      exclusiveFilter: (frame) => {
        return !frame.text.trim() && frame.tag !== 'br';
      }
    }).trim();
  };

  /**
   * Sanitize plain text content (no HTML allowed)
   * Use for comments, reviews, etc.
   */
  const sanitizePlainText = (text: string): string => {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return sanitizeHtml(text, {
      allowedTags: [],
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    }).trim();
  };

  /**
   * Validate if HTML contains only allowed tags
   * Returns true if safe, false if contains disallowed content
   */
  const isValidHtml = (html: string): boolean => {
    if (!html) return true;

    const sanitized = sanitizeDescription(html);
    // If sanitization significantly changed the content, it had invalid tags
    return sanitized.length > 0 && sanitized.length >= (html.length * 0.8);
  };

  /**
   * Strip all HTML tags and return plain text
   */
  const stripHtml = (html: string): string => {
    if (!html || typeof html !== 'string') {
      return '';
    }

    return sanitizeHtml(html, {
      allowedTags: [],
      allowedAttributes: {}
    }).trim();
  };

  return {
    sanitizeDescription,
    sanitizePlainText,
    isValidHtml,
    stripHtml
  };
}
