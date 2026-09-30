// The DI entry point: every decorated class imports its decorators from here, so reflect-metadata
// is always loaded before any of them is evaluated. Resolve with container.resolve(Class).
import "reflect-metadata";

export { container, inject, injectable, singleton } from "tsyringe";
