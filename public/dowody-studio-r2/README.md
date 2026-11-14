# Dowody CI Studia R2, uratowane przed wygaśnięciem

Otwiera się pod [`/dowody-studio-r2/`](index.html) w Jaskini — ten sam adres co pasek
[„Do obejrzenia"](../do-obejrzenia/index.html), karta nr 5.

Zrzuty z dziesięciu przebiegów CI gałęzi `experiment/browser-studio-r2-source-world-2026-11-10`
(Studio R2 Browsera GPT: edytor źródła i żywy świat w oknach Jaskini), 10 XI 2026.
Artefakty `studio-r2-native-evidence` wygasały 17 XI. Skopiowane 13 XI bez zmiany treści;
nazwa katalogu: `run<id przebiegu>_<commit>`, wróć do źródła przez
`gh api repos/Jozzpoly/Jozz-Cave-Workbench/actions/runs/<id>`.

Ta sama zasada co na gałęzi `dowody/ci-gpt6-worldbench-2026-11` (Opus Code): artefakt CI
jest wygodą na kilka dni, nie miejscem przechowywania, a dysk właściciela nie jest magazynem.

**Czemu to leży na `main`, a nie na gałęzi podglądu.** Do 14 XI stało na `podglad/dowody-studio-r2`
i karta na pasku wskazywała adres podglądu tej gałęzi. Taki adres żyje dokładnie tak długo
jak gałąź: rzecz uratowana przed wygaśnięciem wisiała na czymś, co też wygasa, i żaden mechanizm
tego nie pilnował. Przeniesienie na `main` kosztuje 2,4 MB w `public/` i usuwa tę zależność.

Czego tu nie ma: wyników testów starej Jaskini z automatu (`jaskinia-<przebieg>`, odtwarzalne
ponownym przebiegiem) ani zrzutów A/B z 17 X (`jaskinia-ab-*`, żyją do I 2027).
