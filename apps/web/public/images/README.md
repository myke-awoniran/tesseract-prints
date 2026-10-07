# Images

The hero slideshow reads its slides from `src/content/site.ts` (`SLIDES`). Each slide has a full-size file
(2400px wide) and an optional `-sm` file (1280px) for phones.

| File | Subject | Photographer | Licence |
| --- | --- | --- | --- |
| `abuja-aso-rock.jpg` | Aso Rock, Abuja | Uzoma Ozurumba | CC BY-SA 4.0 |
| `lagos-victoria-island.jpg` | Victoria Island, Lagos | Ayorinde Ogundele | CC BY-SA 4.0 |
| `abuja-national-mosque.jpg` | National Mosque, Abuja | Mark Fischer | CC BY-SA 2.0 |
| `lagos-third-mainland.jpg` | Third Mainland Bridge, Lagos | S. Aderogba | CC BY-SA 4.0 |
| `lagos-lekki-ikoyi.jpg` | Lekki–Ikoyi Link Bridge, Lagos | Chippla | CC BY-SA 3.0 |
| `lagos-island.jpg` | Lagos Island | Sir Demo | CC BY-SA 4.0 |
| `bridge.jpg` | Suspension bridge | Your own photo | n/a |

All third-party photos are from Wikimedia Commons. Their licences require crediting the photographer,
which the hero does with the small "Photo: …" link on each slide. Keep the `credit` field when you swap a photo.

Use photos you own, commission, or license (Wikimedia Commons, Unsplash, Pexels). Images saved from Pinterest
usually belong to someone else and are not licensed for commercial use.

Recommended: landscape JPEG, 2400px wide, under 600 KB. The site renders them in a purple monochrome
automatically, so colour grading doesn't matter. Set `focus` (a CSS object-position) to keep the subject in frame on phones.
