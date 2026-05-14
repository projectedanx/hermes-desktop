import { execFileSync } from "child_process";
import { existsSync, promises as fsPromises } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  HERMES_HOME,
  HERMES_PYTHON,
  HERMES_SCRIPT,
  HERMES_REPO,
  getEnhancedPath,
} from "./installer";
import { profileHome } from "./utils";

export interface InstalledSkill {
  name: string;
  category: string;
  description: string;
  path: string;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  category: string;
  source: string;
  installed: boolean;
}

/**
 * Parse SKILL.md frontmatter (YAML between --- markers) for name/description.
 */
function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
} {
  const result = { name: "", description: "" };

  // Check for YAML frontmatter
  if (!content.startsWith("---")) {
    // Fall back to first heading and first paragraph
    const headingMatch = content.match(/^#\s+(.+)/m);
    if (headingMatch) result.name = headingMatch[1].trim();
    const paraMatch = content.match(/^(?!#)(?!---).+/m);
    if (paraMatch) result.description = paraMatch[0].trim().slice(0, 120);
    return result;
  }

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return result;

  const frontmatter = content.slice(3, endIdx);

  const nameMatch = frontmatter.match(/^\s*name:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  const descMatch = frontmatter.match(
    /^\s*description:\s*["']?([^"'\n]+)["']?\s*$/m,
  );
  if (descMatch) result.description = descMatch[1].trim();

  return result;
}

/**
 * Walk the skills directory to find all installed skills.
 * Structure: skills/<category>/<skill-name>/SKILL.md
 */
export async function listInstalledSkills(
  profile?: string,
): Promise<InstalledSkill[]> {
  const skillsDir = join(profileHome(profile), "skills");
  if (!existsSync(skillsDir)) return [];

  const skills: InstalledSkill[] = [];

  try {
    const categories = await fsPromises.readdir(skillsDir);

    const categoryPromises = categories.map(async (category) => {
      const categoryPath = join(skillsDir, category);
      const stat = await fsPromises.stat(categoryPath).catch(() => null);
      if (!stat || !stat.isDirectory()) return;

      const entries = await fsPromises.readdir(categoryPath).catch(() => []);
      const entryPromises = entries.map(async (entry) => {
        const entryPath = join(categoryPath, entry);
        const entryStat = await fsPromises.stat(entryPath).catch(() => null);
        if (!entryStat || !entryStat.isDirectory()) return;

        const skillFile = join(entryPath, "SKILL.md");
        const fileStat = await fsPromises.stat(skillFile).catch(() => null);
        if (!fileStat || !fileStat.isFile()) return;

        try {
          const buffer = await fsPromises.readFile(skillFile);
          const content = buffer.toString("utf-8").slice(0, 4000);
          const meta = parseSkillFrontmatter(content);

          skills.push({
            name: meta.name || entry,
            category,
            description: meta.description || "",
            path: entryPath,
          });
        } catch {
          skills.push({
            name: entry,
            category,
            description: "",
            path: entryPath,
          });
        }
      });
      await Promise.all(entryPromises);
    });

    await Promise.all(categoryPromises);
  } catch {
    // ignore
  }

  return skills.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/**
 * Get the full content of a SKILL.md for the detail view.
 */
export async function getSkillContent(skillPath: string): Promise<string> {
  const skillFile = join(skillPath, "SKILL.md");
  const fileStat = await fsPromises.stat(skillFile).catch(() => null);
  if (!fileStat || !fileStat.isFile()) return "";

  try {
    const buffer = await fsPromises.readFile(skillFile);
    return buffer.toString("utf-8");
  } catch {
    return "";
  }
}

/**
 * Search the skill registry via the hermes CLI.
 */
export function searchSkills(query: string): SkillSearchResult[] {
  try {
    const output = execFileSync(
      HERMES_PYTHON,
      [HERMES_SCRIPT, "skills", "browse", "--query", query, "--json"],
      {
        cwd: HERMES_REPO,
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
          HOME: homedir(),
          HERMES_HOME,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      },
    );

    const text = output.toString().trim();
    if (!text) return [];

    // Try to parse JSON output
    try {
      const results = JSON.parse(text);
      if (Array.isArray(results)) {
        return results.map((r: Record<string, string>) => ({
          name: r.name || "",
          description: r.description || "",
          category: r.category || "",
          source: r.source || "",
          installed: false,
        }));
      }
    } catch {
      // If JSON parsing fails, the CLI may not support --json flag
      // Fall back to listing bundled skills that match
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * List bundled skills from the hermes-agent repo.
 */
export async function listBundledSkills(): Promise<SkillSearchResult[]> {
  const bundledDir = join(HERMES_REPO, "skills");
  if (!existsSync(bundledDir)) return [];

  const skills: SkillSearchResult[] = [];

  try {
    const categories = await fsPromises.readdir(bundledDir);

    const categoryPromises = categories.map(async (category) => {
      const catPath = join(bundledDir, category);
      const stat = await fsPromises.stat(catPath).catch(() => null);
      if (!stat || !stat.isDirectory()) return;

      const entries = await fsPromises.readdir(catPath).catch(() => []);
      const entryPromises = entries.map(async (entry) => {
        const entryPath = join(catPath, entry);
        const entryStat = await fsPromises.stat(entryPath).catch(() => null);
        if (!entryStat || !entryStat.isDirectory()) return;

        const skillFile = join(entryPath, "SKILL.md");
        const fileStat = await fsPromises.stat(skillFile).catch(() => null);
        if (!fileStat || !fileStat.isFile()) return;

        try {
          const buffer = await fsPromises.readFile(skillFile);
          const content = buffer.toString("utf-8").slice(0, 4000);
          const meta = parseSkillFrontmatter(content);

          skills.push({
            name: meta.name || entry,
            description: meta.description || "",
            category,
            source: "bundled",
            installed: false,
          });
        } catch {
          skills.push({
            name: entry,
            description: "",
            category,
            source: "bundled",
            installed: false,
          });
        }
      });
      await Promise.all(entryPromises);
    });

    await Promise.all(categoryPromises);
  } catch {
    // ignore
  }

  return skills.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

export function installSkill(
  identifier: string,
  profile?: string,
): { success: boolean; error?: string } {
  try {
    const args = [HERMES_SCRIPT, "skills", "install", identifier, "--yes"];
    if (profile && profile !== "default") {
      args.splice(1, 0, "-p", profile);
    }

    execFileSync(HERMES_PYTHON, args, {
      cwd: HERMES_REPO,
      env: {
        ...process.env,
        PATH: getEnhancedPath(),
        HOME: homedir(),
        HERMES_HOME,
      },
      stdio: "pipe",
      timeout: 60000,
    });
    return { success: true };
  } catch (err) {
    const msg =
      (err as { stderr?: Buffer }).stderr?.toString() || (err as Error).message;
    return { success: false, error: msg.trim() };
  }
}

export function uninstallSkill(
  name: string,
  profile?: string,
): { success: boolean; error?: string } {
  try {
    const args = [HERMES_SCRIPT, "skills", "uninstall", name];
    if (profile && profile !== "default") {
      args.splice(1, 0, "-p", profile);
    }

    execFileSync(HERMES_PYTHON, args, {
      cwd: HERMES_REPO,
      env: {
        ...process.env,
        PATH: getEnhancedPath(),
        HOME: homedir(),
        HERMES_HOME,
      },
      stdio: "pipe",
      timeout: 30000,
    });
    return { success: true };
  } catch (err) {
    const msg =
      (err as { stderr?: Buffer }).stderr?.toString() || (err as Error).message;
    return { success: false, error: msg.trim() };
  }
}
