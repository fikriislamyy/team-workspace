import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    createParamDecorator,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthedUser } from "@team-workspace/shared";
import { AuthService } from "./auth.service.js";

export interface AuthedRequest extends Request {
    user?: AuthedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private readonly auth: AuthService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        const header = req.headers.authorization;

        if (!header?.startsWith("Bearer ")) {
            throw new UnauthorizedException("Missing bearer token");
        }

        try {
            req.user = await this.auth.authenticate(header.slice(7));
            return true;
        } catch {
            throw new UnauthorizedException("Invalid token");
        }
    }
}

export const CurrentUser = createParamDecorator(
    (_data: unknown, context: ExecutionContext): AuthedUser => {
        const req = context.switchToHttp().getRequest<AuthedRequest>();
        if (!req.user) {
            throw new UnauthorizedException();
        }
        return req.user;
    },
);