import { validateSkillName } from "./skill-name.js";
const SLUG_REGEX = /^[a-zA-Z0-9_.-]+$/;
const OWNER_REGEX = /^[a-zA-Z0-9_-]+$/;
const SLUG_MAX = 200;
const OWNER_MAX = 100;
export function validateSlug(slug) {
    if (slug.length === 0)
        throw new Error(`Invalid slug: ${slug}`);
    if (slug.length > SLUG_MAX)
        throw new Error(`Invalid slug: ${slug}`);
    if (!SLUG_REGEX.test(slug))
        throw new Error(`Invalid slug: ${slug}`);
    // Reuse existing path traversal protection
    validateSkillName(slug);
    return slug;
}
export function validateOwner(owner) {
    if (owner.length === 0)
        throw new Error(`Invalid owner: ${owner}`);
    if (owner.length > OWNER_MAX)
        throw new Error(`Invalid owner: ${owner}`);
    if (!OWNER_REGEX.test(owner))
        throw new Error(`Invalid owner: ${owner}`);
    return owner;
}
//# sourceMappingURL=safe-slug.js.map