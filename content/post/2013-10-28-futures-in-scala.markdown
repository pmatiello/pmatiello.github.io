---
title:  "Futures in Scala"
date:   2013-10-28 21:00:00
---

Scala 2.10
introduced [futures](http://docs.scala-lang.org/overviews/core/futures.html) as
a convenient abstraction for concurrent programming. Using futures, one can
perform a number of computations in parallel for which the result is expected to
be available, at some point, in these `Future` objects.

A result in a `Future` can be easily retrieved without blocking the execution
flow by setting a callback to be invoked once it's ready:

```scala
val fut = future { slowComputation }

fut.onSuccess {
	case result => useSuccess(result)
}
```

This callback is guaranteed to be executed after the future completes
successfully. It's also possible request a callback to be executed if the future
fails with an exception:

```scala
fut.onFailure {
	case exception => useError(exception)
}
```

Alternativelly, a single callback can be defined for handling both success and
failure cases:

```scala
fut.onComplete {
	case Success(result) => useSuccess(result)
	case Failure(exception) => useError(exception)
}
```

Finally, if blocking is acceptable, one can simply wait until the value is
available:

```scala
Await.result(fut, Duration.Inf)
```

This isn't what you probably want, though.

## Some convenient operations

Even though futures are easier to handle than most other approaches to
concurrency, they are not really a transparent solution. In fact, sometimes they
can be a little tricky to use while still retaining its advantages. For
instance, how does one, holding a future for some value, obtains a modified
version of this value without waiting for its evaluation?

Fortunatelly, the API for futures in Scala is quite helpful in cases like this.

### From future of value to future of modified value

Given a future `fut` for a value `v` and a function `f`, it's quite
straightforward to obtain a new future for a value `f(v)` without waiting for
`v` to be evaluated:

```scala
fut.map(f)
```

### From list of futures to future of list

It's possible turn a list of futures into a future of a list for the same
values. That is, given a `List` of `Future` objects
`List(Future(v1), Future(v2), ...)`, it is possible to produce a `Future` object
such as `Future(List(v1, v2, ...))`:

```scala
Future.sequence(list)
```

### Reduce list of futures to future value

It's also possible to take a list of futures `List(Future(v1), Future(v2), ...)`
and a reduction function `f` to produce a new future containing
`List(v1, v2, ...).reduce(f)` as value:

```scala
Future.reduce(list)(f)
```

### Reduce future of list to future value

Finally, given the future of a list `Future(List(v1, v2, ...))` and a reduction
function `f`, a new future containing `List(v1, v2, ...).reduce(f)` as value can
be produced:

```scala
fut.map { list => list.reduce(f) }
```
