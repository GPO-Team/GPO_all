# Camera regression fixture

`empty-floor.ppm` is the RGB decoding of the project's Webots camera capture
`output/w3d/camera-final.jpg` from 2026-09-18, used in the 2026-09-20 audit.
It contains the empty floor and horizon. The original colour detector reports
103 warm pixels and an obstacle score of approximately 0.061237.

The PPM format lets the native regression test read these exact pixels without
adding an image-decoding dependency. Unconfirmed colour must not produce an
obstacle hint, an occupied map cell or a guessed obstacle distance.
