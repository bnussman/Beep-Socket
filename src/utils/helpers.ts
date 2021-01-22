import database from "./db";
import * as r from "rethinkdb";
import * as Sentry from "@sentry/node";

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function isTokenValid(token: string): Promise<string | null> {
    if (token == null) return null;
    //get (only) user's id from tokens db where the token is the token passed to this function
    //NOTE: filter must be used over get here because token is not a primary (or secondary) key
    try {
        const result: any = await r.table("tokens").get(token).run((await database.getConn()));

        if (result) {
            return result.userid;
        }

        //we did not find this token in the tokens table, so it is not valid,
        //rather then returning a userid, return null to signify that token is not valid.
    }
    catch (error) {
        Sentry.captureException(error);
    }

    return null;
}

export function formulateUserUpdateData(data: any) {
    if (data.new_val == null) {
        console.log("User account was probably deleted.");
        return null;
    }

    const didPasswordChange: boolean = (data.old_val != null) && (data.new_val.password !== data.old_val?.password);

    return ({
        id: data.new_val.id,
        first: data.new_val.first,
        last: data.new_val.last,
        email: data.new_val.email,
        phone: data.new_val.phone,
        capacity: data.new_val.capacity,
        groupRate: data.new_val.groupRate,
        singlesRate: data.new_val.singlesRate,
        inQueueOfUserID: data.new_val.inQueueOfUserID,
        isBeeping: data.new_val.isBeeping,
        venmo: data.new_val.venmo,
        userLevel: data.new_val.userLevel,
        isEmailVerified: data.new_val.isEmailVerified,
        isStudent: data.new_val.isStudent,
        didPasswordChange: didPasswordChange,
        masksRequired: data.new_val.masksRequired,
        photoUrl: data.new_val.photoUrl
    });
}
