# WCAG Compliance Guide for Viz3

This project is configured for WCAG 2.1 AA compliance checking throughout development.

## Tools Configured

### 1. ESLint with jsx-a11y (Build-time)
Catches accessibility issues as you code. Runs automatically when you save files.

**Key rules enforced:**
- Images must have `alt` text
- Buttons/links must be keyboard accessible
- Form inputs must have labels
- ARIA attributes must be valid
- Interactive elements must be focusable

**Run manually:**
```bash
npm run lint        # Full lint check
npm run lint:a11y   # Accessibility-focused check
```

### 2. axe-core/react (Runtime)
Reports accessibility violations in the browser console during development.

- Open DevTools Console while developing
- Look for axe-core warnings/errors
- Each issue includes a link to learn more

## WCAG Quick Reference

### Perceivable
- ✅ All images have descriptive `alt` text
- ✅ Videos have captions
- ✅ Color contrast ratio is 4.5:1 for normal text, 3:1 for large text
- ✅ Don't rely on color alone to convey information

### Operable  
- ✅ All functionality available via keyboard
- ✅ No keyboard traps
- ✅ Skip links for navigation
- ✅ Page titles are descriptive
- ✅ Focus order is logical

### Understandable
- ✅ Language is declared (`<html lang="en">`)
- ✅ Labels on form inputs
- ✅ Error messages are clear
- ✅ Consistent navigation

### Robust
- ✅ Valid HTML
- ✅ ARIA used correctly
- ✅ Works with assistive technologies

## Common Fixes

### Images
```jsx
// ❌ Bad
<img src="chart.png" />

// ✅ Good
<img src="chart.png" alt="Bar chart showing patient counts by cancer type" />

// ✅ Decorative images
<img src="decoration.png" alt="" role="presentation" />
```

### Buttons & Links
```jsx
// ❌ Bad - click handler on div
<div onClick={handleClick}>Click me</div>

// ✅ Good - use button
<button onClick={handleClick}>Click me</button>

// ❌ Bad - empty link
<a href="/page"></a>

// ✅ Good
<a href="/page">Go to page</a>
```

### Forms
```jsx
// ❌ Bad
<input type="text" />

// ✅ Good
<label htmlFor="name">Name</label>
<input id="name" type="text" />

// ✅ Or with aria-label
<input type="text" aria-label="Search patients" />
```

### Interactive Elements
```jsx
// ❌ Bad - div with click but no keyboard support
<div onClick={toggle}>Toggle</div>

// ✅ Good - keyboard accessible
<div 
  onClick={toggle} 
  onKeyDown={(e) => e.key === 'Enter' && toggle()}
  role="button"
  tabIndex={0}
>
  Toggle
</div>

// ✅ Better - just use a button
<button onClick={toggle}>Toggle</button>
```

### Color Contrast
Use tools to check contrast:
- Chrome DevTools (Elements > Styles > color picker)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Skip Navigation
Add to main layout:
```jsx
<a href="#main-content" className="skip-link">
  Skip to main content
</a>
{/* ... header/nav ... */}
<main id="main-content">
  {/* page content */}
</main>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 0;
  z-index: 9999;
  background: #fff;
  padding: 8px;
}
```

## Pre-Commit Checklist

Before committing, verify:
- [ ] `npm run lint` passes with no a11y errors
- [ ] Checked browser console for axe-core warnings
- [ ] New images have alt text
- [ ] New forms have labels
- [ ] New interactive elements are keyboard accessible
- [ ] Color contrast is sufficient

## Testing Tools

### Browser Extensions
- [axe DevTools](https://www.deque.com/axe/devtools/) - Chrome/Firefox
- [WAVE](https://wave.webaim.org/extension/) - Chrome/Firefox
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) - Built into Chrome DevTools

### Screen Reader Testing
- **macOS**: VoiceOver (Cmd+F5)
- **Windows**: NVDA (free), JAWS
- **Browser**: ChromeVox extension

## Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

