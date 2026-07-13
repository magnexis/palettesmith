figma.showUI(__html__, {
  width: 460,
  height: 920,
  themeColors: true
});

type ShadeMap = Record<string, string>;
type ThemeMap = Record<string, string>;
type SemanticMap = Record<string, ShadeMap>;
type NumberTokenMap = Record<string, number>;
type StringTokenMap = Record<string, string>;
type SemanticReference =
  | {
      type: "literal";
      value: string;
    }
  | {
      type: "palette" | "semantic";
      path: string[];
    };
type SemanticModel = Record<string, Record<string, SemanticReference>>;
type SystemPayload = {
  paletteName: string;
  shades: ShadeMap;
  darkShades?: ShadeMap;
  semantic: SemanticMap;
  semanticModel: SemanticModel;
  themes: Record<string, ThemeMap>;
  typography: NumberTokenMap;
  spacing: NumberTokenMap;
  radius: NumberTokenMap;
  shadows: StringTokenMap;
};

type PluginMessage =
  | ({
      type: "create-system";
    } & SystemPayload)
  | {
      type: "notify";
      message: string;
    };

const FONT_REGULAR: FontName = { family: "Inter", style: "Regular" };
const FONT_MEDIUM: FontName = { family: "Inter", style: "Medium" };
const FONT_SEMIBOLD: FontName = { family: "Inter", style: "Semi Bold" };
const FONT_BOLD: FontName = { family: "Inter", style: "Bold" };
const SHADE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function isValidHex(hex: unknown): hex is string {
  return typeof hex === "string" && /^#?([0-9A-Fa-f]{6})$/.test(hex.trim());
}

function normalizeHex(hex: unknown, fallback = "#000000") {
  if (!isValidHex(hex)) {
    return fallback;
  }

  return `#${hex.trim().replace(/^#/, "").toUpperCase()}`;
}

function hexToRgb(hex: unknown): RGB {
  const clean = normalizeHex(hex).replace("#", "");
  const bigint = parseInt(clean, 16);

  return {
    r: clamp(((bigint >> 16) & 255) / 255, 0, 1),
    g: clamp(((bigint >> 8) & 255) / 255, 0, 1),
    b: clamp((bigint & 255) / 255, 0, 1)
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function removePaintStyleIfExists(name: string) {
  const existing = figma.getLocalPaintStyles().find(style => style.name === name);
  if (existing) {
    existing.remove();
  }
}

function createPaintStyle(name: string, hex: string) {
  removePaintStyleIfExists(name);

  const style = figma.createPaintStyle();
  style.name = name;
  style.paints = [
    {
      type: "SOLID",
      color: hexToRgb(hex)
    }
  ];
}

function getOrCreateCollection(name: string) {
  const existing = figma.variables.getLocalVariableCollections().find(collection => collection.name === name);
  return existing ?? figma.variables.createVariableCollection(name);
}

function syncCollectionModes(collection: VariableCollection, modeNames: string[]) {
  const targetModeNames = [...new Set(modeNames)].filter(Boolean);
  const modeIds: Record<string, string> = {};

  if (targetModeNames.length === 0) {
    return modeIds;
  }

  for (const mode of [...collection.modes]) {
    if (targetModeNames.includes(mode.name)) {
      modeIds[mode.name] = mode.modeId;
    }
  }

  for (const modeName of targetModeNames) {
    if (modeIds[modeName]) {
      continue;
    }

    const reusableMode = [...collection.modes].find(mode => !targetModeNames.includes(mode.name));
    if (reusableMode) {
      collection.renameMode(reusableMode.modeId, modeName);
      modeIds[modeName] = reusableMode.modeId;
    } else {
      modeIds[modeName] = collection.addMode(modeName);
    }
  }

  for (const mode of [...collection.modes]) {
    if (!targetModeNames.includes(mode.name) && collection.modes.length > targetModeNames.length) {
      collection.removeMode(mode.modeId);
    }
  }

  return modeIds;
}

function getOrCreateColorVariable(collection: VariableCollection, variableName: string) {
  const existing = figma.variables
    .getLocalVariables("COLOR")
    .find(variable => variable.variableCollectionId === collection.id && variable.name === variableName);

  return existing ?? figma.variables.createVariable(variableName, collection, "COLOR");
}

function getOrCreateNumberVariable(collection: VariableCollection, variableName: string) {
  const existing = figma.variables
    .getLocalVariables("FLOAT")
    .find(variable => variable.variableCollectionId === collection.id && variable.name === variableName);

  return existing ?? figma.variables.createVariable(variableName, collection, "FLOAT");
}

function getOrCreateStringVariable(collection: VariableCollection, variableName: string) {
  const existing = figma.variables
    .getLocalVariables("STRING")
    .find(variable => variable.variableCollectionId === collection.id && variable.name === variableName);

  return existing ?? figma.variables.createVariable(variableName, collection, "STRING");
}

function ensureSingleModeCollection(collection: VariableCollection, modeName: string) {
  const modeIds = syncCollectionModes(collection, [modeName]);
  return modeIds[modeName];
}

function applyNumberVariables(collection: VariableCollection, groupName: string, tokens: NumberTokenMap, modeName: string) {
  const modeId = ensureSingleModeCollection(collection, modeName);

  for (const [token, value] of Object.entries(tokens)) {
    if (!isFiniteNumber(value)) {
      continue;
    }

    const variable = getOrCreateNumberVariable(collection, `${groupName}/${token}`);
    variable.setValueForMode(modeId, value);
  }
}

function applyStringVariables(collection: VariableCollection, groupName: string, tokens: StringTokenMap, modeName: string) {
  const modeId = ensureSingleModeCollection(collection, modeName);

  for (const [token, value] of Object.entries(tokens)) {
    const variable = getOrCreateStringVariable(collection, `${groupName}/${token}`);
    variable.setValueForMode(modeId, value);
  }
}

function setVariableCodeSyntax(variable: Variable, name: string) {
  const normalized = name.replace(/\//g, ".").replace(/[^a-zA-Z0-9._-]/g, "-");
  const cssName = normalized.replace(/\./g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  variable.setVariableCodeSyntax("WEB", `var(--${cssName || "token"})`);
  variable.setVariableCodeSyntax("ANDROID", normalized.replace(/\./g, "_"));
  variable.setVariableCodeSyntax("iOS", normalized);
}

function applyColorVariables(
  collection: VariableCollection,
  themes: Record<string, ThemeMap>,
  semantic: SemanticMap,
  baseShades: ShadeMap,
  darkShades: ShadeMap | undefined,
  semanticModel: SemanticModel
) {
  const themeNames = Object.keys(themes).length ? Object.keys(themes) : ["light"];
  const modeIds = syncCollectionModes(collection, themeNames);
  const variableRegistry = new Map<string, Variable>();

  const registerVariable = (name: string, variable: Variable) => {
    variableRegistry.set(name, variable);
    setVariableCodeSyntax(variable, name);
    return variable;
  };

  const setThemeVariable = (variableName: string, key: string) => {
    const variable = registerVariable(variableName, getOrCreateColorVariable(collection, variableName));
    for (const [themeName, modeId] of Object.entries(modeIds)) {
      const hex = themes[themeName]?.[key];
      if (isValidHex(hex)) {
        variable.setValueForMode(modeId, hexToRgb(hex));
      }
    }
  };

  const themeKeys = new Set<string>();
  for (const theme of Object.values(themes)) {
    for (const key of Object.keys(theme)) {
      themeKeys.add(key);
    }
  }

  for (const key of themeKeys) {
    setThemeVariable(`theme/${key}`, key);
  }

  for (const [shade, hex] of Object.entries(baseShades)) {
    const variable = registerVariable(`palette/base/${shade}`, getOrCreateColorVariable(collection, `palette/base/${shade}`));
    const darkHex = darkShades?.[shade] ?? hex;

    for (const [themeName, modeId] of Object.entries(modeIds)) {
      variable.setValueForMode(modeId, hexToRgb(themeName === "dark" ? darkHex : hex));
    }
  }

  if (darkShades && Object.keys(darkShades).length) {
    for (const [shade, hex] of Object.entries(darkShades)) {
      const variable = registerVariable(`palette/dark/${shade}`, getOrCreateColorVariable(collection, `palette/dark/${shade}`));
      for (const [themeName, modeId] of Object.entries(modeIds)) {
        variable.setValueForMode(modeId, hexToRgb(themeName === "dark" ? hex : (baseShades[shade] ?? hex)));
      }
    }
  }

  for (const [role, palette] of Object.entries(semantic)) {
    for (const [shade, hex] of Object.entries(palette)) {
      const variable = registerVariable(`semantic/${role}/${shade}`, getOrCreateColorVariable(collection, `semantic/${role}/${shade}`));
      for (const modeId of Object.values(modeIds)) {
        variable.setValueForMode(modeId, hexToRgb(hex));
      }
    }
  }

  const resolveAliasTarget = (reference: SemanticReference) => {
    if (reference.type === "palette") {
      return variableRegistry.get(`palette/${reference.path[0]}/${reference.path[1]}`);
    }

    if (reference.type === "semantic") {
      return variableRegistry.get(`semantic/${reference.path[0]}/${reference.path[1]}`);
    }

    return undefined;
  };

  for (const [themeName, roles] of Object.entries(semanticModel)) {
    const modeId = modeIds[themeName];
    if (!modeId) {
      continue;
    }

    for (const [roleName, reference] of Object.entries(roles)) {
      const variableName = `role/${roleName}`;
      const variable = registerVariable(variableName, getOrCreateColorVariable(collection, variableName));
      const aliasTarget = resolveAliasTarget(reference);

      if (aliasTarget) {
        variable.setValueForMode(modeId, figma.variables.createVariableAlias(aliasTarget));
      } else if (reference.type === "literal") {
        variable.setValueForMode(modeId, hexToRgb(reference.value));
      }
    }
  }
}

function createSystemArtifacts(msg: SystemPayload) {
  const paletteName = msg.paletteName || "Primary";

  for (const [shade, hex] of Object.entries(msg.shades)) {
    createPaintStyle(`Brand/${paletteName}/${shade}`, hex);
  }

  if (msg.darkShades) {
    for (const [shade, hex] of Object.entries(msg.darkShades)) {
      createPaintStyle(`Brand/Dark/${paletteName}/${shade}`, hex);
    }
  }

  for (const [role, palette] of Object.entries(msg.semantic)) {
    for (const [shade, hex] of Object.entries(palette)) {
      createPaintStyle(`Semantic/${role}/${shade}`, hex);
    }
  }

  const colorCollection = getOrCreateCollection(`${paletteName} Colors`);
  applyColorVariables(colorCollection, msg.themes, msg.semantic, msg.shades, msg.darkShades, msg.semanticModel);

  const typographyCollection = getOrCreateCollection(`${paletteName} Typography`);
  applyNumberVariables(typographyCollection, "fontSize", msg.typography, "Base");

  const spacingCollection = getOrCreateCollection(`${paletteName} Spacing`);
  applyNumberVariables(spacingCollection, "space", msg.spacing, "Base");

  const radiusCollection = getOrCreateCollection(`${paletteName} Radius`);
  applyNumberVariables(radiusCollection, "radius", msg.radius, "Base");

  const shadowCollection = getOrCreateCollection(`${paletteName} Shadows`);
  applyStringVariables(shadowCollection, "shadow", msg.shadows, "Base");
}

async function loadFonts() {
  await Promise.all([
    figma.loadFontAsync(FONT_REGULAR),
    figma.loadFontAsync(FONT_MEDIUM),
    figma.loadFontAsync(FONT_SEMIBOLD),
    figma.loadFontAsync(FONT_BOLD)
  ]);
}

function makeFrame(name: string, width: number, height?: number) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(width, height ?? 100);
  frame.layoutMode = "VERTICAL";
  frame.counterAxisSizingMode = "FIXED";
  frame.primaryAxisSizingMode = "AUTO";
  frame.itemSpacing = 16;
  frame.paddingLeft = 20;
  frame.paddingRight = 20;
  frame.paddingTop = 20;
  frame.paddingBottom = 20;
  frame.cornerRadius = 24;
  frame.strokes = [{ type: "SOLID", color: hexToRgb("#1F2937"), opacity: 0.5 }];
  return frame;
}

function makeText(text: string, size: number, fontName: FontName, fillHex: string) {
  const node = figma.createText();
  node.fontName = fontName;
  node.characters = text;
  node.fontSize = size;
  node.fills = [{ type: "SOLID", color: hexToRgb(fillHex) }];
  return node;
}

function applyFill(node: GeometryMixin, hex: string) {
  node.fills = [{ type: "SOLID", color: hexToRgb(hex) }];
}

function getTextColorForSwatch(shade: string) {
  return ["50", "100", "200", "300", "400"].includes(shade) ? "#0F172A" : "#FFFFFF";
}

function makeSwatchCard(shade: string, hex: string) {
  const swatchHex = normalizeHex(hex);
  const card = makeFrame(`Swatch ${shade}`, 150, 98);
  card.layoutMode = "VERTICAL";
  card.counterAxisSizingMode = "FIXED";
  card.primaryAxisSizingMode = "FIXED";
  card.itemSpacing = 8;
  card.paddingLeft = 14;
  card.paddingRight = 14;
  card.paddingTop = 14;
  card.paddingBottom = 14;
  card.cornerRadius = 18;
  card.resize(150, 98);
  applyFill(card, swatchHex);
  card.strokes = [{ type: "SOLID", color: hexToRgb("#FFFFFF"), opacity: 0.12 }];

  const textColor = getTextColorForSwatch(shade);
  const title = makeText(shade, 14, FONT_BOLD, textColor);
  const value = makeText(swatchHex, 12, FONT_MEDIUM, textColor);
  card.appendChild(title);
  card.appendChild(value);

  return card;
}

function makeMetricCard(titleText: string, valueText: string) {
  const card = makeFrame(titleText, 180, 86);
  card.itemSpacing = 8;
  card.cornerRadius = 18;
  card.resize(180, 86);
  applyFill(card, "#111827");
  card.strokes = [{ type: "SOLID", color: hexToRgb("#334155"), opacity: 0.45 }];

  card.appendChild(makeText(titleText, 12, FONT_BOLD, "#F8FAFC"));
  card.appendChild(makeText(valueText, 12, FONT_REGULAR, "#94A3B8"));
  return card;
}

function makeButton(text: string, backgroundHex: string, textHex: string, isGhost = false) {
  const button = makeFrame(text, 140, 44);
  button.layoutMode = "HORIZONTAL";
  button.counterAxisSizingMode = "FIXED";
  button.primaryAxisSizingMode = "FIXED";
  button.resize(140, 44);
  button.itemSpacing = 0;
  button.paddingLeft = 16;
  button.paddingRight = 16;
  button.paddingTop = 12;
  button.paddingBottom = 12;
  button.counterAxisAlignItems = "CENTER";
  button.primaryAxisAlignItems = "CENTER";
  button.cornerRadius = 16;
  applyFill(button, backgroundHex);
  button.strokes = isGhost
    ? [{ type: "SOLID", color: hexToRgb("#CBD5E1"), opacity: 0.22 }]
    : [];
  button.appendChild(makeText(text, 13, FONT_BOLD, textHex));
  return button;
}

function makeSectionTitle(titleText: string, subtitleText: string) {
  const group = makeFrame(`${titleText} Header`, 1120);
  group.layoutMode = "VERTICAL";
  group.itemSpacing = 4;
  group.paddingLeft = 0;
  group.paddingRight = 0;
  group.paddingTop = 0;
  group.paddingBottom = 0;
  group.strokes = [];
  group.fills = [];
  group.appendChild(makeText(titleText, 20, FONT_BOLD, "#F8FAFC"));
  group.appendChild(makeText(subtitleText, 12, FONT_REGULAR, "#94A3B8"));
  return group;
}

async function createPlayground(msg: SystemPayload) {
  await loadFonts();

  const page = figma.createPage();
  page.name = `${msg.paletteName} Playground`;
  figma.currentPage = page;

  const canvas = makeFrame("PaletteSmith Playground", 1200);
  canvas.x = 120;
  canvas.y = 120;
  applyFill(canvas, "#0B1020");
  canvas.strokes = [];
  page.appendChild(canvas);

  const hero = makeFrame("Hero", 1120);
  hero.itemSpacing = 12;
  hero.cornerRadius = 28;
  applyFill(hero, "#111827");
  hero.strokes = [{ type: "SOLID", color: hexToRgb("#4338CA"), opacity: 0.3 }];
  hero.effects = [
    {
      type: "DROP_SHADOW",
      color: { ...hexToRgb("#000000"), a: 0.2 },
      offset: { x: 0, y: 16 },
      radius: 40,
      spread: 0,
      visible: true,
      blendMode: "NORMAL"
    }
  ];
  hero.appendChild(makeText("DESIGN SYSTEM PLAYGROUND", 11, FONT_BOLD, "#C4B5FD"));
  hero.appendChild(makeText(msg.paletteName, 40, FONT_BOLD, "#F8FAFC"));
  hero.appendChild(makeText("PaletteSmith generated this playground with theme colors, semantic roles, sample tokens, and reusable preview components.", 14, FONT_REGULAR, "#94A3B8"));

  const heroStats = figma.createFrame();
  heroStats.name = "Hero Stats";
  heroStats.layoutMode = "HORIZONTAL";
  heroStats.counterAxisSizingMode = "AUTO";
  heroStats.primaryAxisSizingMode = "AUTO";
  heroStats.itemSpacing = 12;
  heroStats.fills = [];
  heroStats.strokes = [];
  heroStats.appendChild(makeMetricCard("Themes", Object.keys(msg.themes).join(" / ")));
  heroStats.appendChild(makeMetricCard("Spacing", `${Object.keys(msg.spacing).length} tokens`));
  heroStats.appendChild(makeMetricCard("Semantic", Object.keys(msg.semantic).join(", ")));
  hero.appendChild(heroStats);
  canvas.appendChild(hero);

  canvas.appendChild(makeSectionTitle("Palette Ramp", "Base system swatches from 50 through 950"));
  const swatchGrid = figma.createFrame();
  swatchGrid.name = "Palette Swatches";
  swatchGrid.layoutMode = "HORIZONTAL";
  swatchGrid.layoutWrap = "WRAP";
  swatchGrid.counterAxisSizingMode = "AUTO";
  swatchGrid.primaryAxisSizingMode = "AUTO";
  swatchGrid.itemSpacing = 12;
  swatchGrid.fills = [];
  swatchGrid.strokes = [];
  swatchGrid.resize(1120, 10);
  for (const shade of SHADE_KEYS) {
    swatchGrid.appendChild(makeSwatchCard(shade, msg.shades[shade]));
  }
  canvas.appendChild(swatchGrid);

  canvas.appendChild(makeSectionTitle("Theme Preview", "Light and dark surfaces generated from semantic roles"));
  const themesRow = figma.createFrame();
  themesRow.name = "Themes";
  themesRow.layoutMode = "HORIZONTAL";
  themesRow.itemSpacing = 16;
  themesRow.fills = [];
  themesRow.strokes = [];

  for (const [themeName, theme] of Object.entries(msg.themes)) {
    const card = makeFrame(`${themeName} Theme`, 552);
    card.cornerRadius = 24;
    applyFill(card, theme.surface ?? theme.background ?? "#111827");
    card.strokes = [{ type: "SOLID", color: hexToRgb(theme.border ?? "#334155"), opacity: 0.45 }];
    card.appendChild(makeText(`${themeName[0].toUpperCase()}${themeName.slice(1)} Theme`, 18, FONT_BOLD, theme.text ?? "#F8FAFC"));
    card.appendChild(makeText(`Background ${theme.background} • Surface ${theme.surface} • Accent ${theme.accent}`, 12, FONT_REGULAR, theme.textMuted ?? theme.text ?? "#94A3B8"));

    const buttons = figma.createFrame();
    buttons.name = `${themeName} Buttons`;
    buttons.layoutMode = "HORIZONTAL";
    buttons.itemSpacing = 10;
    buttons.fills = [];
    buttons.strokes = [];
    buttons.appendChild(makeButton("Primary", theme.accent, theme.accentText ?? "#FFFFFF"));
    buttons.appendChild(makeButton("Secondary", theme.surface, theme.text ?? "#F8FAFC", true));
    card.appendChild(buttons);
    themesRow.appendChild(card);
  }
  canvas.appendChild(themesRow);

  canvas.appendChild(makeSectionTitle("Tokens", "Foundations for typography, spacing, radius, and shadows"));
  const tokenRow = figma.createFrame();
  tokenRow.name = "Token Row";
  tokenRow.layoutMode = "HORIZONTAL";
  tokenRow.itemSpacing = 16;
  tokenRow.fills = [];
  tokenRow.strokes = [];
  tokenRow.appendChild(makeMetricCard("Typography", Object.values(msg.typography).join(", ")));
  tokenRow.appendChild(makeMetricCard("Spacing", Object.values(msg.spacing).join(", ")));
  tokenRow.appendChild(makeMetricCard("Radius", Object.values(msg.radius).join(", ")));
  tokenRow.appendChild(makeMetricCard("Shadows", Object.keys(msg.shadows).join(", ")));
  canvas.appendChild(tokenRow);

  canvas.appendChild(makeSectionTitle("Component Preview", "A starter card built with the generated system"));
  const preview = makeFrame("Preview Card", 1120);
  preview.layoutMode = "HORIZONTAL";
  preview.itemSpacing = 18;
  preview.cornerRadius = 28;
  applyFill(preview, "#0F172A");
  preview.strokes = [{ type: "SOLID", color: hexToRgb("#1E293B"), opacity: 0.5 }];

  const mainCard = makeFrame("Sample Component", 620);
  mainCard.cornerRadius = 24;
  applyFill(mainCard, msg.themes.light?.surface ?? "#FFFFFF");
  mainCard.strokes = [{ type: "SOLID", color: hexToRgb(msg.themes.light?.border ?? "#CBD5E1"), opacity: 0.5 }];
  mainCard.effects = [
    {
      type: "DROP_SHADOW",
      color: { ...hexToRgb("#000000"), a: 0.12 },
      offset: { x: 0, y: 12 },
      radius: 36,
      spread: 0,
      visible: true,
      blendMode: "NORMAL"
    }
  ];
  mainCard.appendChild(makeText("Primary Surface", 26, FONT_BOLD, msg.themes.light?.text ?? "#0F172A"));
  mainCard.appendChild(makeText(`Accent ${msg.themes.light?.accent} with ${Object.keys(msg.spacing).length} spacing steps and ${Object.keys(msg.radius).length} radius tokens.`, 14, FONT_REGULAR, msg.themes.light?.textMuted ?? "#64748B"));

  const actionRow = figma.createFrame();
  actionRow.name = "Action Row";
  actionRow.layoutMode = "HORIZONTAL";
  actionRow.itemSpacing = 12;
  actionRow.fills = [];
  actionRow.strokes = [];
  actionRow.appendChild(makeButton("Generate", msg.themes.light?.accent ?? msg.shades["500"], msg.themes.light?.accentText ?? "#FFFFFF"));
  actionRow.appendChild(makeButton("Secondary", msg.themes.light?.surface ?? "#FFFFFF", msg.themes.light?.text ?? "#0F172A", true));
  mainCard.appendChild(actionRow);

  const sideRail = makeFrame("Side Rail", 430);
  sideRail.cornerRadius = 24;
  applyFill(sideRail, "#111827");
  sideRail.strokes = [{ type: "SOLID", color: hexToRgb("#1E293B"), opacity: 0.5 }];
  sideRail.appendChild(makeText("System Notes", 18, FONT_BOLD, "#F8FAFC"));
  sideRail.appendChild(makeText(`Styles: Brand + Semantic\nThemes: ${Object.keys(msg.themes).join(", ")}\nExports: CSS, Tailwind, JSON`, 13, FONT_REGULAR, "#94A3B8"));
  sideRail.appendChild(makeText("Use this page as a visual regression and publish-ready showcase inside Figma.", 13, FONT_REGULAR, "#CBD5E1"));

  preview.appendChild(mainCard);
  preview.appendChild(sideRail);
  canvas.appendChild(preview);

  figma.viewport.scrollAndZoomIntoView([canvas]);
}

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === "notify") {
    figma.notify(msg.message);
    return;
  }

  if (msg.type === "create-system") {
    createSystemArtifacts(msg);
    figma.notify(`Synced ${msg.paletteName || "Primary"} styles and variables`);
    return;
  }

};
