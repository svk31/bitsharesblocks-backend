import _ from "lodash";

export default {
    shortBlock: (block) => {

        return {
            id: block.id,
            witness: block.witness,
            witness_name: block.witness_name,
            trxCount: block.transactions.length,
            timestamp: block.timestamp
        }
    },
    fullBlock: (block) => {

        let transactions = block.transactions.length === 0 ? [] :
            block.transactions.map(trx => {
                console.log("trx:", trx);

                return {
                    expiration: trx.expiration,
                    operations: trx.operations
                }
            });

        return {
            id: block.id,
            witness: block.witness,
            witness_name: block.witness_name,
            trxCount: transactions,
            timestamp: block.timestamp
        }
    },
    shortWitness: (witness) => {
        return {
            name: witness.name,
            witness_account: witness.witness_account,
            last_aslot: witness.last_aslot,
            total_missed: witness.total_missed,
            total_votes: witness.total_votes,
            last_conf: witness.last_confirmed_block_num,
            balance: witness.balance
        }
    },
    fullWitness: (witness) => {
        return witness;
    },
    dynGlobalProperty: (object) => {
        console.log("object:", object);
        return {
            reg_accounts: object.accounts_registered_this_interval,
            current_aslot: object.current_aslot,
            witness: object.current_witness,
            head: object.head_block_number,
            last_irr: object.last_irreversible_block_num,
            next_time: object.next_maintenance_time,
            missed: object.recently_missed_count,
            time: object.time,
            budget: object.witness_budget
        }
    }
}