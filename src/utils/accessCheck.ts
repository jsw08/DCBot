import config from "../../config.json" with {type: "json"}
import { embed } from "./embed.ts";

export const checkAccess = (id: string): boolean => {
    return !config.private.enabled || config.private.user_ids.includes(id)
}
export const accessDeniedEmbed = embed({message: "Access denied", kindOfEmbed: "error"})
