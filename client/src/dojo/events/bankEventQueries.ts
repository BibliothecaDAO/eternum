import { gql } from "graphql-request";
import { ReplaySubject, Observable } from "rxjs";
import { getLastLoginTimestamp } from "../../hooks/store/useNotificationsStore";
import { client, getEventsQuery, wsClient } from "./graphqlClient";

export function computeFees(bank_entity_id: bigint) {
  // todo: query swap events and compute fees
}
