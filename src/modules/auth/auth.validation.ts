type UnknownRecord = Record<string, unknown>;

export function validateRegisterInput(data: UnknownRecord | undefined) {
    const errors: string[] = [];
    const email = data?.email;
    const username = data?.username;
    const password = data?.password;

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('Email invalide.');
    }

    if (typeof username !== 'string' || username.trim().length < 3) {
        errors.push("Le nom d'utilisateur doit contenir au moins 3 caractères.");
    }

    if (typeof password !== 'string' || password.length < 6) {
        errors.push('Le mot de passe doit contenir au moins 6 caractères.');
    }

    return errors;
}

export function validateLoginInput(data: UnknownRecord | undefined) {
    const errors: string[] = [];
    const email = data?.email;
    const password = data?.password;

    if (typeof email !== 'string' || email.length === 0) {
        errors.push('Email requis.');
    }

    if (typeof password !== 'string' || password.length === 0) {
        errors.push('Mot de passe requis.');
    }

    return errors;
}
