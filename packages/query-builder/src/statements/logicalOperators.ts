import { join, liter, PrimitiveValue, raw, Sql, sql } from "@trong-orm/sql";

enum TokenType {
  Binary = "Binary",
  Unary = "Unary",
  Alias = "Alias",
  Compound = "Compound",
  Select = "Select",
  Values = "Values",
  RawSql = "RawSql",
}

type IAlias = IToken<TokenType.Alias> & { left: IToken; right: string };

export const alias = (
  left: IToken | Sql | PrimitiveValue,
  right: string
): IAlias => {
  return {
    type: TokenType.Alias,
    left: toToken(left),
    right,
    toSql() {
      return sql`${wrapParentheses(this.left)} AS ${liter(this.right)}`;
    },
  };
};

// type ICompound = IToken<TokenType.Compound> & {
//   compoundType: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT";
//   left: IToken;
//   right: IToken;
// };

// const compound = (
//   type: ICompound["compoundType"],
//   left: IToken | Sql,
//   right: IToken | Sql
// ): ICompound => {
//   return {
//     type: TokenType.Compound,
//     compoundType: type,
//     left: toToken(left),
//     right: toToken(right),
//     toSql() {
//       return sql`${this.left} ${raw(this.compoundType)} ${this.right}`;
//     },
//   };
// };

// export const union = (left: IToken | Sql, right: IToken | Sql): ICompound => {
//   return compound("UNION", left, right);
// };
// export const unionAll = (
//   left: IToken | Sql,
//   right: IToken | Sql
// ): ICompound => {
//   return compound("UNION ALL", left, right);
// };
// export const intersect = (
//   left: IToken | Sql,
//   right: IToken | Sql
// ): ICompound => {
//   return compound("INTERSECT", left, right);
// };
// export const except = (left: IToken | Sql, right: IToken | Sql): ICompound => {
//   return compound("EXCEPT", left, right);
// };

export const isToken = (t: unknown): t is IToken => {
  return (
    t !== null &&
    typeof t === "object" &&
    "type" in t &&
    "toSql" in t &&
    Object.values(TokenType).includes((t as IToken).type)
  );
};

// export const isStatement = (t: unknown): t is IToken<TokenType> => {
//   return (
//     t !== null &&
//     typeof t === "object" &&
//     "type" in t &&
//     (t as IToken).type === TokenType.Statement
//   );
// };

interface IToken<T extends TokenType = TokenType> {
  type: T;
  toSql(): Sql;
}

const buildRawSql = (t: Sql | PrimitiveValue): IToken<TokenType.RawSql> => {
  return {
    type: TokenType.RawSql,
    toSql() {
      return sql`${t}`;
    },
  };
};

const toToken = (t: IToken | Sql | PrimitiveValue): IToken => {
  if (isToken(t)) return t;

  if (t instanceof Sql) {
    return buildRawSql(t);
  }

  return buildRawSql(t);
};

interface IUnaryOperator extends IToken<TokenType.Unary> {
  operator: "NOT";
  expr: IToken | Sql | PrimitiveValue;
}

export const not = (expr: IToken | Sql | PrimitiveValue): IUnaryOperator => {
  return {
    operator: "NOT",
    type: TokenType.Unary,
    expr,
    toSql() {
      return sql`NOT (${expr})`;
    },
  };
};

const wrapParentheses = <T extends IToken | Sql | PrimitiveValue>(
  val: T
): T | Sql =>
  (isBinaryOperator(val) && val.operator === "OR") ||
  (isToken(val) &&
    (val.type === TokenType.Select || val.type === TokenType.Values))
    ? sql`(${val})`
    : val;

// TODO: in null support
interface IBinaryOperator extends IToken<TokenType.Binary> {
  operator:
    | "<"
    | "<="
    | ">"
    | ">="
    | "="
    | "<>"
    | "AND"
    | "OR"
    | "IN"
    | "NOT IN"
    // TODO: add all
    | "BETWEEN"
    | "NOT BETWEEN"
    | "GLOB"
    | "NOT GLOB"
    | "LIKE"
    | "NOT LIKE"
    | "MATCH"
    | "NOT MATCH"
    | "REGEXP"
    | "NOT REGEXP";
  left: IToken;
  right: IToken | IToken[];
}

const isBinaryOperator = (t: unknown): t is IBinaryOperator => {
  return (
    t !== null &&
    typeof t === "object" &&
    "type" in t &&
    "format" in t &&
    (t as IBinaryOperator).type === TokenType.Binary
  );
};

const binaryOperator = (
  operator: IBinaryOperator["operator"],
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue | (IToken | Sql | PrimitiveValue)[]
): IBinaryOperator => {
  return {
    type: TokenType.Binary,
    left: toToken(left),
    right: Array.isArray(right) ? right.map(toToken) : toToken(right),
    operator,
    toSql() {
      return sql`${wrapParentheses(this.left)} ${raw(this.operator)} ${
        Array.isArray(this.right)
          ? sql`(${join(this.right)})`
          : wrapParentheses(this.right)
      }`;
    },
  };
};

export const notEq$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => notEq(left, right);
};
export const notEq = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator("<>", left, right);
};

export const eq$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => eq(left, right);
};
export const eq = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator("=", left, right);
};

export const gt$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => gt(left, right);
};
export const gt = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator(">", left, right);
};

export const gtEq$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => gtEq(left, right);
};
export const gtEq = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator(">=", left, right);
};

export const lt$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => lt(left, right);
};
export const lt = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator("<", left, right);
};

export const ltEq$ = (right: IToken | Sql | PrimitiveValue) => {
  return (left: IToken | Sql | PrimitiveValue) => ltEq(left, right);
};
export const ltEq = (
  left: IToken | Sql | PrimitiveValue,
  right: IToken | Sql | PrimitiveValue
) => {
  return binaryOperator("<=", left, right);
};

export const In = (
  left: IToken | Sql | PrimitiveValue,
  ...right: (IToken | Sql | PrimitiveValue)[]
) => {
  return binaryOperator("IN", left, right);
};
export const notIn = (
  left: IToken | Sql | PrimitiveValue,
  ...right: (IToken | Sql | PrimitiveValue)[]
) => {
  return binaryOperator("NOT IN", left, right);
};

export const in$ =
  (...values: (IToken | Sql | PrimitiveValue)[]) =>
  (left: IToken | Sql | PrimitiveValue) => {
    return In(left, ...values);
  };

type IConditionValue =
  | IToken
  | Sql
  | Record<
      string,
      | ((left: IToken | Sql | PrimitiveValue) => IBinaryOperator)
      | IToken
      | Sql
      | PrimitiveValue
    >;
const conditionValuesToToken = (values: IConditionValue[]) => {
  return values
    .flatMap((v) =>
      isToken(v) || v instanceof Sql
        ? toToken(v)
        : Object.entries(v).map(([k, expr]) =>
            toToken(
              typeof expr === "function" ? expr(liter(k)) : eq(raw(k), expr)
            )
          )
    )
    .filter((v) => !v.toSql().isEmpty);
};
const conditionOperator = (
  type: "AND" | "OR",
  ...values: IConditionValue[]
): IBinaryOperator => {
  const exprs = conditionValuesToToken(values);

  if (exprs.length <= 1) {
    throw new Error("Must at least two arguments present");
  }

  let current = binaryOperator(type, exprs[0], exprs[1]);

  for (const next of exprs.slice(2)) {
    current = binaryOperator(type, current, next);
  }

  return current;
};

export const and = (...values: IConditionValue[]): IBinaryOperator => {
  return conditionOperator("AND", ...values);
};

export const or = (...values: IConditionValue[]): IBinaryOperator => {
  return conditionOperator("OR", ...values);
};

interface IValueStatement extends IToken<TokenType.Values> {
  values: IToken[][];
}

export const values = (
  ...vals: (IToken | Sql | PrimitiveValue)[][]
): IValueStatement => {
  return {
    type: TokenType.Values,
    values: vals.map((val) => val.map(toToken)),
    toSql() {
      return sql`VALUES ${join(this.values.map((val) => sql`(${join(val)})`))}`;
    },
  };
};

const isSelect = (val: unknown): val is ISelectStatement => {
  return (
    val !== null &&
    typeof val === "object" &&
    (val as ISelectStatement).type === TokenType.Select
  );
};

type IUnionArg = ISelectStatement | IValueStatement | Sql;
interface ISelectStatement extends IToken<TokenType.Select> {
  distinctValue: boolean;

  withValue?: {
    recursive: boolean;
    values: {
      name: string;
      columns: string[];
      select: ISelectStatement | IValueStatement | IToken<TokenType.RawSql>;
    }[];
  };
  selectValues: IToken[];
  fromValues: IToken[];
  groupByValues: IToken[];
  whereValue?: IToken;
  limitValue?: IToken;
  offsetValue?: IToken;
  havingValue?: IToken;
  compoundValues: {
    compoundType: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT";
    value: ISelectStatement | IValueStatement | IToken<TokenType.RawSql>;
  }[];

  distinct(val: boolean): ISelectStatement;
  select(...args: ISelectArgType[]): ISelectStatement;
  from(...values: (IToken | Sql | PrimitiveValue)[]): ISelectStatement;
  where(...values: IConditionValue[]): ISelectStatement;
  orWhere(...values: IConditionValue[]): ISelectStatement;
  groupBy(...values: (IToken | Sql)[]): ISelectStatement;
  having(val: IToken | Sql): ISelectStatement;
  with(
    tableName: string,
    columns: string[],
    toSelect: ISelectStatement | IValueStatement | Sql
  ): ISelectStatement;
  withRecursive(
    tableName: string,
    columns: string[],
    toSelect: ISelectStatement | IValueStatement | Sql
  ): ISelectStatement;

  withoutOrder(): ISelectStatement;
  withoutLimit(): ISelectStatement;
  withoutOffset(): ISelectStatement;
  withoutWith(): ISelectStatement;

  limit(val: IToken | Sql | PrimitiveValue): ISelectStatement;
  offset(val: IToken | Sql | PrimitiveValue): ISelectStatement;

  union(...values: IUnionArg[]): ISelectStatement;
  unionAll(...values: IUnionArg[]): ISelectStatement;
  intersect(...values: IUnionArg[]): ISelectStatement;
  except(...values: IUnionArg[]): ISelectStatement;
}

type ISelectArgType =
  | string
  | Sql
  | ISelectStatement
  | { [key: string]: Sql | string | ISelectStatement }
  | IToken;
const selectArgsToValues = (args: ISelectArgType[]) => {
  if (args === null || args === undefined) return [toToken(sql`*`)];

  return args
    .flatMap((arg) => {
      if (typeof arg === "string") return raw(arg);
      if (isToken(arg) || arg instanceof Sql) return arg;

      return Object.entries(arg).map(([columnOrAs, aliasOrQuery]) =>
        typeof aliasOrQuery === "string"
          ? alias(liter(columnOrAs), aliasOrQuery)
          : alias(aliasOrQuery, columnOrAs)
      );
    })
    .map((t) => toToken(wrapParentheses(t)));
};

const makeCompounds = (
  type: "UNION" | "UNION ALL" | "INTERSECT" | "EXCEPT",
  values: IUnionArg[]
) => {
  return values.map((val) => {
    const token = toToken(val);

    return {
      compoundType: type,
      value: isSelect(token)
        ? token.withoutWith().withoutLimit().withoutOrder().withoutOffset()
        : (token as IValueStatement | IToken<TokenType.RawSql>),
    };
  });
};

export const select = (...selectArgs: ISelectArgType[]): ISelectStatement => {
  const constructWhere = function (
    this: ISelectStatement,
    andOrOr: "and" | "or",
    ...values: IConditionValue[]
  ): ISelectStatement {
    const finalValues = this.whereValue
      ? [this.whereValue, ...conditionValuesToToken(values)]
      : conditionValuesToToken(values);

    if (finalValues.length > 1) {
      return {
        ...this,
        whereValue:
          andOrOr === "and" ? and(...finalValues) : or(...finalValues),
      };
    } else {
      return { ...this, whereValue: finalValues[0] };
    }
  };

  return {
    type: TokenType.Select,
    fromValues: [],
    selectValues: selectArgsToValues(selectArgs),
    distinctValue: false,
    groupByValues: [],
    compoundValues: [],
    select(...selectArgs: ISelectArgType[]) {
      return {
        ...this,
        selectValues: [...this.selectValues, ...selectArgsToValues(selectArgs)],
      };
    },
    distinct(val: boolean) {
      return {
        ...this,
        distinctValue: val,
      };
    },
    from(...values: (IToken | Sql | string)[]): ISelectStatement {
      return {
        ...this,
        fromValues: [
          ...this.fromValues,
          ...values.map((v) =>
            toToken(wrapParentheses(typeof v === "string" ? liter(v) : v))
          ),
        ],
      };
    },
    where(...values: IConditionValue[]): ISelectStatement {
      return constructWhere.bind(this)("and", ...values);
    },
    orWhere(...values: IConditionValue[]): ISelectStatement {
      return constructWhere.bind(this)("or", ...values);
    },
    limit(val: IToken | Sql | PrimitiveValue) {
      return { ...this, limitValue: toToken(val) };
    },
    offset(val: IToken | Sql | PrimitiveValue) {
      return { ...this, offsetValue: toToken(val) };
    },
    groupBy(...values: (IToken | Sql)[]): ISelectStatement {
      return { ...this, groupByValues: values.map(toToken) };
    },
    having(val: IToken | Sql) {
      return { ...this, havingValue: toToken(val) };
    },
    withoutLimit() {
      return { ...this, limitValue: undefined };
    },
    withoutOffset() {
      return { ...this, offsetValue: undefined };
    },
    withoutOrder() {
      return { ...this };
    },
    withoutWith() {
      return { ...this, withValue: undefined };
    },
    withRecursive(
      tableName: string,
      columns: string[],
      toSelect: ISelectStatement | IValueStatement | Sql
    ): ISelectStatement {
      if (this.withValue?.recursive === false) {
        throw new Error("WITH is already not recursive");
      }

      return {
        ...this,
        withValue: {
          recursive: true,
          values: [
            ...(this.withValue?.values || []),
            {
              name: tableName,
              columns,
              select:
                toSelect instanceof Sql ? buildRawSql(toSelect) : toSelect,
            },
          ],
        },
      };
    },
    with(
      tableName: string,
      columns: string[],
      toSelect: ISelectStatement | IValueStatement | Sql
    ) {
      if (this.withValue?.recursive === true) {
        throw new Error("WITH is already recursive");
      }

      return {
        ...this,
        withValue: {
          recursive: true,
          values: [
            ...(this.withValue?.values || []),
            {
              name: tableName,
              columns,
              select:
                toSelect instanceof Sql ? buildRawSql(toSelect) : toSelect,
            },
          ],
        },
      };
    },
    union(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("UNION", values),
        ],
      };
    },
    unionAll(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("UNION ALL", values),
        ],
      };
    },
    intersect(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("INTERSECT", values),
        ],
      };
    },
    except(...values: ISelectStatement[]): ISelectStatement {
      return {
        ...this,
        compoundValues: [
          ...this.compoundValues,
          ...makeCompounds("EXCEPT", values),
        ],
      };
    },
    toSql() {
      return join(
        [
          ...(this.withValue
            ? [
                sql`WITH`,
                this.withValue.recursive ? sql`RECURSIVE` : null,
                join(
                  this.withValue.values.map(
                    (v) =>
                      sql`${liter(v.name)}(${join(v.columns.map(liter))}) AS (${
                        v.select
                      })`
                  )
                ),
              ]
            : []),
          sql`SELECT${this.distinctValue ? sql` DISTINCT ` : sql` `}${join(
            this.selectValues
          )}`,
          this.fromValues.length === 0
            ? null
            : sql`FROM ${join(this.fromValues)}`,
          this.whereValue ? sql`WHERE ${this.whereValue}` : null,
          this.groupByValues.length > 0
            ? sql`GROUP BY ${join(this.groupByValues)}`
            : null,
          this.groupByValues.length > 0 && this.havingValue
            ? sql`HAVING ${this.havingValue}`
            : null,
          this.compoundValues.length > 0
            ? join(
                this.compoundValues.map(
                  (val) => sql`${raw(val.compoundType)} ${val.value.toSql()}`
                ),
                " "
              )
            : null,
          this.limitValue
            ? sql`LIMIT ${wrapParentheses(this.limitValue)}`
            : null,
          this.offsetValue && this.limitValue
            ? sql`OFFSET ${wrapParentheses(this.offsetValue)}`
            : null,
        ].filter((v) => v),
        " "
      );
    },
  };
};

// TODO: problem with column name duplication
// maybe do https://mikro-orm.io/docs/query-conditions ?
// Actually not poblem! Could be duplicated in next where
// RULE: if object key — then it is identifier
// If just string — then this val will be replaced(except alias)
console.log(
  select(
    { kek: select(sql`1`) },
    { kek: select(sql`1`) },
    alias(select("3"), "rer.kek")
  )
    .select("53")
    .distinct(true)
    .from(select("1"), select("2"))
    .groupBy(sql`strftime(kek, "Y")`)
    .where({ "k.kk": gt$(5) })
    .where(or({ kek: gt$(5), pog: gt$(2000) }))
    .orWhere({ wow: gt$(2000) })
    .limit(10)
    .offset(5)
    .union(select(sql`1`).limit(5))
    .union(values([3, 4], [5, 6]))
    .with("kek", ["n1", "n2"], values([3, 5]))
    .toSql()
    .inspect()
);

// console.log(Object.entries({ a: 5, w: gtEq$(6) }));
// console.log(or(eq(1, 2), eq(3, 4)).toSql().inspect());
// console.log(
//   or({ k: eq$(2), f: eq$(4) })
//     .toSql()
//     .inspect()
// );

// console.log(binaryOperator("=", raw("kk"), 4).toSql().inspect());
// console.log(
//   and(
//     { a: 5, w: gtEq$(6), k: in$(5, 6), wow: sql`(SELECT 1)` },
//     not(or({ kek: 1, puk: 0 })),
//     // TODO: if string — just strip, don't use "sql`...`"
//     eq(sql`test`, 55)
//   )
//     .toSql()
//     .inspect()
// );

// console.log(and({ wow: 5 }, { kek: 6 }).toSql().inspect());

// interface IWhereClause {}
// interface ISelectClause {
//   __discriminator:
//   whereStatement?: IWhereStatement;
// }

// // TODO:

// // statement
// // Select уже задаёт структуру хммм...
// const select;
