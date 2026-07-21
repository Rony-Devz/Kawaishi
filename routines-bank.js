/* ============================================================================
   Kawaishi — built-in ROUTINES BANK (curated by the owner).
   ----------------------------------------------------------------------------
   UPDATE-SAFE: user routines live in localStorage (kawaishi_routines_v1);
   shipping a new bankVersion here NEVER touches what a user personally added.
   Bump bankVersion whenever you change the curated routines below.

   Item reference scheme (see routines.js -> resolveItem):
     techId: "kaj1_1" | "at-keri-1" | ...   -> data.js catalog (judo/atemi/bjj)
     techId: "sd:0"                          -> K.techniques.selfdef[0] (has Hebrew steps)
     custom: { he, romaji, en }              -> free-text (techId === null)
     steps:  null                            -> fall back to the technique's own steps
             ["...", "..."]                  -> Hebrew override authored here

   LANGUAGE: Hebrew-only content (titles, group names, step overrides).
   ========================================================================== */
window.KAWAISHI_ROUTINES = {
  bankVersion: 1,
  routines: [
    {
      id: "bank_choke_defenses",
      builtIn: true,
      title: { he: "הגנות מפני חניקה", en: "Choke defenses" },
      groups: [
        {
          id: "g_warmup",
          title: { he: "חימום ואטמי", en: "Warm-up & atemi" },
          items: [
            { techId: "at-keri-1", custom: null, steps: null }
          ]
        },
        {
          id: "g_front",
          title: { he: "הגנות מפני חניקה מלפנים", en: "Front choke defenses" },
          items: [
            { techId: "sd:0", custom: null, steps: null },
            { techId: "sd:1", custom: null, steps: null },
            { techId: "sd:2", custom: null, steps: null }
          ]
        }
      ]
    },
    {
      id: "bank_standing_basics",
      builtIn: true,
      title: { he: "יסודות עמידה", en: "Standing basics" },
      groups: [
        {
          id: "g_kicks",
          title: { he: "בעיטות בסיס", en: "Basic kicks" },
          items: [
            { techId: "at-keri-1", custom: null, steps: null }
          ]
        }
      ]
    }
  ]
};
