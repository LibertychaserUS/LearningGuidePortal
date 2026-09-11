# Portal — published course page

Compiled from existing unit tests. Suite is armed. Overlay select runs this product_command.

## UC-PORTAL-1 Course page primitives

### Functional
- Title: Course identity comes from the product store
- Steps: Open a published course as a tourist
- Expected: Title, track, lesson count and preview flag match the store, not leftover chrome

### Negative
- Title: Unpublished or missing course is not presented as a published page
- Steps: Request a course that is not published
- Expected: Not a fabricated published identity

### Depth
- Title: Paid access still reads identity from the store
- Steps: Purchase the course; open the course page
- Expected: Title and track still come from the store, not leftover chrome

### Edge
- Title: Visitor syllabus is previewable versus locked
- Steps: Open the published course with no entitlement
- Expected: Public first lesson is previewable; remaining lessons stay locked
