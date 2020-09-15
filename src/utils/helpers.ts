import { conn } from "./db";
import * as r from "rethinkdb";

/**
 * Retuns user's id if their token is valid, null otherwise
 *
 * @param token takes a user's auth token as input
 * @return userid if token is valid, null otherwise
 */
export async function isTokenValid(token: string): Promise<string | null> {
    //get (only) user's id from tokens db where the token is the token passed to this function
    //NOTE: filter must be used over get here because token is not a primary (or secondary) key
    try {
        const result: any = await r.table("tokens").get(token).run(conn);

        if (result) {
            return result.userid;
        }

        //we did not find this token in the tokens table, so it is not valid,
        //rather then returning a userid, return null to signify that token is not valid.
    }
    catch (error) {
        console.error(error);
    }

    return null;
}

export function formulateUserUpdateData(data: any) {
    const didPasswordChange: boolean = (data.old_val != null) && (data.new_val.password !== data.old_val?.password);

    return ({
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
        isEmailVerified: data.new_val.isEmailVerified,
        isStudent: data.new_val.isStudent,
        didPasswordChange: didPasswordChange
    });
}
