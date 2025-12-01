/// Variant with required fields for testing purposes
Class Data.Titanic2 Extends %Library.Persistent
{

Property PassengerId As %Library.Integer [ Required ];

Property Survived As %Library.Integer;

Property Pclass As %Library.Integer;

Property Name As %Library.String(MAXLEN = 250) [ Required ];

Property Sex As %Library.String(MAXLEN = 250);

Property Age As %Library.Integer;

Property SibSp As %Library.Integer;

Property Parch As %Library.Integer;

Property Ticket As %Library.String(MAXLEN = 250);

Property Fare As %Library.Currency;

Property Cabin As %Library.String(MAXLEN = 250);

Property Embarked As %Library.String(MAXLEN = 250);

}
