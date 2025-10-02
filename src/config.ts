// Central configuration for on-chain module addresses & constants.
// For local dev you can replace this with environment-variable driven logic.
// Example: export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS as string;
// For now we default to a placeholder admin address (update after publishing Move package).
export const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MIKO_ADDRESS || '0xADMINPLACEHOLDER';
