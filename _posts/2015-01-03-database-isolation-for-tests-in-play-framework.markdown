---
layout: post
title:  "Database Isolation for Tests in Play Framework"
date:   2015-01-03 19:00:00
categories: scala playframework testing
---

[Play Framework](https://www.playframework.com) provides decent support for unit and functional tests. Tests using the `WithApplication`, `WithServer` or the `WithBrowser` abstract classes will bootstrap your application so that configurations are loaded and databases connections are available. Yet, nothing is provided out of the box to ensure that database changes made during the execution of a test will not leak into other tests or into the development environment.

## About Play, Slick and specs2

Here, we'll be using [Slick](http://slick.typesafe.com) for persistence and [specs2](http://etorreborre.github.io/specs2/) as testing framework, but the general idea should apply to different libraries without any major changes. The use of these libraries with Play is outside the scope of this post, but these links should do a good job at introducing the subject:

* [Testing your application with specs2](https://www.playframework.com/documentation/2.3.x/ScalaTestingWithSpecs2)
* [Writing functional tests with specs2](https://www.playframework.com/documentation/2.3.x/ScalaFunctionalTestingWithSpecs2)
* [playframework/play-slick](https://github.com/playframework/play-slick)


## Isolating the test database from the development database

The first thing to do is to make our tests run in a different database than the one we use for developing the application. This will ensure that changes to the data in the database performed during the execution of the tests do not disturb the data necessary for developing the application.

In a [previous post](/2014/12/using-a-different-configuration-file-when-running-tests-in-a-play-project.html), I've described one possible approach for that. It envolves using a surrogate configuration file, with a different database configuration, and configuring [SBT](https://typesafe.com/community/core-tools/activator-and-sbt) to instruct Play to load this file instead of the regular `application.conf` when executing tests.

## Isolating tests from each other

Once that we have distinct databases for testing and development, it's time to isolate the tests from each other so that the success or failure of them do not depend on which tests were run and in which order.

The idea here is to have a `DatabaseIsolation` trait that can be composed with the `WithApplication`, `WithServer` and `WithBrowser` abstract classes. It should empty every table in the database before each test is run. Here's what a test should look like when this trait is used:

{% highlight scala %}
"do stuff using the database" in new WithApplication with DatabaseIsolation {
  DB.withTransaction { implicit session =>
    ...
  }
}
{% endhighlight %}

This trait can be implemented as an *around* scope. Notice the `prepareDatabase` method which is responsible for clearing the database. Its implementation will, of course, vary depending of the project and persistence solution in use.

{% highlight scala %}
trait DatabaseIsolation extends Around with Scope {
  abstract override def around[T: AsResult](t: => T): Result = {
    super.around {
      import play.api.Play.current // Put implicit Play application in scope
      DB.withTransaction { implicit session => prepareDatabase }
      t // Execute test
    }
  }

  protected def prepareDatabase(implicit session: Session): Unit = {
    (Schema.someTable :: Schema.otherTable :: Nil).foreach(_.delete)
  }
}
{% endhighlight %}

In tests, Play's default behaviour is to apply the [database evolutions](https://www.playframework.com/documentation/2.3.x/Evolutions) automatically when necessary, so we don't have to worry about that here.

## Seeding the database with test data

At some tests, we may want to have a minimal database with some predefined data instead of an empty one. Given a `Seed` object capable of filling the database with such data, we can define a `SeededDatabase` trait as a child trait of `DatabaseIsolation`, described above. It should be able to, before each test, empty the database just like before but also add some data to it leaving the tables in a predictable state.

{% highlight scala %}
trait SeededDatabase extends DatabaseIsolation {
  abstract override protected def prepareDatabase(implicit session: Session): Unit = {
    super.prepareDatabase
    Seed.seed // Fill the database with some test data
  }
}
{% endhighlight %}

This trait can be used like the other:

{% highlight scala %}
"do stuff using the database" in new WithApplication with SeededDatabase {
  DB.withTransaction { implicit session =>
    ...
  }
}
{% endhighlight %}

## Conclusion

Proper database isolation for tests is important to avoid spurious successes (which hide problems in the tested code) or failures (which reduce our trust in the tests). It also helps us to avoid seemingly non-deterministic behaviour in our tests and provides us with a predictable, clean state for our tests to execute upon, making them simpler to reason about.

Play provides only basic database support (configuration, connection pools, evolutions) and it doesn't prescribe any specific persistence library. Although this provides a lot of flexibility, it also means that the framework can't do much to isolate the database during the tests. Yet, as we can see, it's possible to implement such isolation very easily, cleanly and without any changes to the production code.
